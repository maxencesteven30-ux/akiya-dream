import {
  computeBudget,
  computeBudgetScenarios,
  computeRiskFlags,
  type BudgetBreakdown,
  type BudgetScenario,
  type RiskFlag,
} from "@/lib/calculations";
import { getBuildingEraCode } from "@/lib/building-eras";
import type {
  BuyerProfile,
  ListingCondition,
  RealListing,
  Region,
  RenovationLevel,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Poids nominaux (règle de gestion posée ici, pas une mesure). Total si les
// 4 critères sont calculables : 100.
// ---------------------------------------------------------------------------
const WEIGHT_PRIX = 35;
const WEIGHT_TRAVAUX = 30;
const WEIGHT_ANCIENNETE = 15;
const WEIGHT_ETAT = 20;

// Pente de la logistique du critère Prix : calibrée pour que prix = médiane
// régionale donne 5/10 (neutre), -50% donne ~8,5/10 (bon sans être un 10
// automatique) et +50% donne ~1,5/10. Constante de gestion, pas une donnée
// mesurée.
const PRICE_LOGISTIC_STEEPNESS = 3.5;

// Bornes de score par ère (cf. lib/building-eras.ts) : mesure le risque
// résiduel non financier (amiante, plomberie/électricité datées, norme
// sismique) qui n'est PAS déjà capté par le coût des travaux estimé par
// computeSurfaceBasedRenovation — pour éviter de pénaliser deux fois le
// même phénomène.
const ERA_SCORE: Record<"PRE_1981" | "POST_1981" | "POST_2000", number> = {
  PRE_1981: 3,
  POST_1981: 7,
  POST_2000: 10,
};

const CONDITION_SCORE: Record<Exclude<ListingCondition, "unknown">, number> = {
  good: 10,
  fair: 7,
  needs_renovation: 4,
  major_renovation: 1,
};

const CONDITION_LABELS: Record<ListingCondition, string> = {
  good: "Bon état",
  fair: "État correct",
  needs_renovation: "Travaux à prévoir",
  major_renovation: "Rénovation lourde nécessaire",
  unknown: "État inconnu",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export type OpportunitySubScoreKey = "prix" | "travaux" | "anciennete" | "etat";

export interface OpportunitySubScore {
  key: OpportunitySubScoreKey;
  label: string;
  score: number; // 0-10
  weight: number; // poids nominal (35/30/15/20)
  justification: string;
}

export type OpportunityCategory =
  | "faible"
  | "risquee"
  | "interessante"
  | "bonne"
  | "tres_bonne";

export const OPPORTUNITY_CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  faible: "🔴 Opportunité faible",
  risquee: "🟠 Opportunité risquée",
  interessante: "🟡 Potentiel intéressant",
  bonne: "🟢 Bonne opportunité",
  tres_bonne: "🟢 Très bonne opportunité",
};

export function categorizeOpportunityScore(score: number): OpportunityCategory {
  if (score < 3) return "faible";
  if (score < 5) return "risquee";
  if (score < 7) return "interessante";
  if (score < 8.5) return "bonne";
  return "tres_bonne";
}

export type OpportunityConfidenceLevel = "low" | "medium" | "high";

export const OPPORTUNITY_CONFIDENCE_LABELS: Record<OpportunityConfidenceLevel, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Élevée",
};

// Règle objective, testée isolément : nombre de signaux de qualité présents
// parmi { année, surface, état, région/médiane }. Ne doit jamais être
// confondu avec la note elle-même (section 11 du cahier des charges).
export function computeConfidenceLevel(input: {
  hasConstructionYear: boolean;
  hasSurfaceM2: boolean;
  hasCondition: boolean;
  hasRegion: boolean;
}): OpportunityConfidenceLevel {
  const qualityCount = [
    input.hasConstructionYear,
    input.hasSurfaceM2,
    input.hasCondition,
    input.hasRegion,
  ].filter(Boolean).length;

  if (qualityCount <= 1) return "low";
  if (qualityCount <= 3) return "medium";
  return "high";
}

// -- Sous-scores individuels -------------------------------------------------

function scorePrix(prixAchatJpy: number, region: Region | null): OpportunitySubScore | null {
  if (!region || !region.medianPriceJpy) return null;

  const ratio = prixAchatJpy / region.medianPriceJpy;
  const raw = 10 / (1 + Math.exp(PRICE_LOGISTIC_STEEPNESS * (ratio - 1)));
  const score = round1(clamp(raw, 0, 10));

  const percentDiff = Math.round((ratio - 1) * 100);
  const justification =
    percentDiff <= 0
      ? `Prix inférieur de ${Math.abs(percentDiff)}% à la médiane régionale (${region.prefecture.replace(/_/g, " ")}).`
      : `Prix supérieur de ${percentDiff}% à la médiane régionale (${region.prefecture.replace(/_/g, " ")}).`;

  return { key: "prix", label: "Prix", score, weight: WEIGHT_PRIX, justification };
}

function scoreTravaux(travauxRefJpy: number, prixAchatJpy: number): OpportunitySubScore {
  const safePrix = prixAchatJpy > 0 ? prixAchatJpy : 1;
  const ratio = travauxRefJpy / safePrix;
  const score = round1(clamp(10 - 10 * ratio, 0, 10));

  const justification =
    ratio <= 0.3
      ? "Travaux estimés modérés par rapport au prix d'achat."
      : ratio >= 1
        ? "Travaux estimés au moins aussi coûteux que le prix d'achat."
        : "Travaux estimés représentant une part significative du prix d'achat.";

  return { key: "travaux", label: "Travaux", score, weight: WEIGHT_TRAVAUX, justification };
}

function scoreAnciennete(
  constructionYear: number | null,
  region: Region | null,
): OpportunitySubScore | null {
  if (constructionYear !== null) {
    const era = getBuildingEraCode(constructionYear);
    const score = ERA_SCORE[era];
    const justification =
      era === "PRE_1981"
        ? `Construit en ${constructionYear} (avant 1981) : risque résiduel plus élevé (amiante, plomberie/électricité datées, norme sismique ancienne).`
        : era === "POST_1981"
          ? `Construit en ${constructionYear} (1981-1999) : norme sismique moderne, risque résiduel modéré.`
          : `Construit en ${constructionYear} (2000 ou après) : norme moderne, risque résiduel faible.`;
    return { key: "anciennete", label: "Ancienneté", score, weight: WEIGHT_ANCIENNETE, justification };
  }

  if (region) {
    const score = round1(clamp(10 - (region.pre1981Percent / 100) * 7, 3, 10));
    const justification = `Année de construction inconnue : estimation à partir du taux de bâti pré-1981 de ${region.prefecture.replace(/_/g, " ")} (${region.pre1981Percent}%).`;
    return { key: "anciennete", label: "Ancienneté", score, weight: WEIGHT_ANCIENNETE, justification };
  }

  return null;
}

function scoreEtat(condition: ListingCondition): OpportunitySubScore | null {
  if (condition === "unknown") return null;
  const score = CONDITION_SCORE[condition];
  return {
    key: "etat",
    label: "État",
    score,
    weight: WEIGHT_ETAT,
    justification: `État déclaré : ${CONDITION_LABELS[condition].toLowerCase()}.`,
  };
}

// -- Points forts / vigilance -------------------------------------------------

function deriveStrengths(
  subScores: OpportunitySubScore[],
  prixAchatJpy: number,
  region: Region | null,
): string[] {
  const strengths: string[] = [];
  const byKey = Object.fromEntries(subScores.map((s) => [s.key, s]));

  if (byKey.prix && byKey.prix.score >= 6.5 && region) {
    strengths.push(
      `Prix inférieur à la référence régionale de ${region.prefecture.replace(/_/g, " ")}.`,
    );
  }
  if (byKey.travaux && byKey.travaux.score >= 6.5) {
    strengths.push("Travaux estimés maîtrisés par rapport au prix d'achat.");
  }
  if (byKey.etat && byKey.etat.score >= 7) {
    strengths.push("État général déclaré relativement bon.");
  }
  if (byKey.anciennete && byKey.anciennete.score >= 7) {
    strengths.push("Bâti récent : risque structurel résiduel plus faible.");
  }

  void prixAchatJpy;
  return strengths;
}

// -- Assemblage complet -------------------------------------------------------

export interface OpportunityInput {
  prixAchatJpy: number;
  profile: BuyerProfile;
  renovationLevel: RenovationLevel;
  region: Region | null;
  listing: RealListing;
}

export interface OpportunityResult {
  score: number;
  category: OpportunityCategory;
  confidence: OpportunityConfidenceLevel;
  subScores: OpportunitySubScore[];
  budget: BudgetBreakdown;
  scenarios: BudgetScenario[];
  riskFlags: RiskFlag[];
  strengths: string[];
  coverageIncomplete: boolean;
}

export const OPPORTUNITY_DISCLAIMER =
  "Cette note constitue une estimation indicative basée sur les informations renseignées " +
  "et les données disponibles dans Akiya Dream. Elle ne remplace pas une expertise " +
  "immobilière, technique, juridique ou fiscale. Les éléments du bien doivent être " +
  "vérifiés avant toute décision.";

export const OPPORTUNITY_HEADLINE =
  "Cette maison présente une opportunité intéressante selon les données renseignées.";

const OPPORTUNITY_HEADLINE_CAUTIOUS =
  "Cette maison présente des signaux de vigilance importants selon les données renseignées.";

// La formulation prudente évite d'affirmer "bonne affaire" (section 15), mais
// ne doit pas non plus sonner faussement positive pour une note basse : les
// catégories faible/risquée utilisent un intitulé qui reflète la vigilance.
export function getOpportunityHeadline(category: OpportunityCategory): string {
  return category === "faible" || category === "risquee"
    ? OPPORTUNITY_HEADLINE_CAUTIOUS
    : OPPORTUNITY_HEADLINE;
}

export const OPPORTUNITY_VERIFICATION_REMINDER =
  "Vérifie l'état structurel, la toiture, les réseaux, les éventuels travaux non visibles " +
  "et les documents du bien avant toute décision.";

export function computeOpportunityScore(input: OpportunityInput): OpportunityResult {
  const { prixAchatJpy, profile, renovationLevel, region, listing } = input;

  const refinement =
    listing.constructionYear !== null && listing.surfaceM2 !== null
      ? { constructionYear: listing.constructionYear, surfaceM2: listing.surfaceM2 }
      : null;

  const budget = computeBudget(prixAchatJpy, profile, renovationLevel, refinement);
  const scenarios = computeBudgetScenarios(prixAchatJpy, profile, renovationLevel, refinement);
  const realiste = scenarios.find((s) => s.label === "realiste") ?? scenarios[0];

  const candidates: (OpportunitySubScore | null)[] = [
    scorePrix(prixAchatJpy, region),
    scoreTravaux(realiste.travauxJpy, prixAchatJpy),
    scoreAnciennete(listing.constructionYear, region),
    scoreEtat(listing.condition),
  ];

  const subScores = candidates.filter((c): c is OpportunitySubScore => c !== null);

  const totalWeight = subScores.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = subScores.reduce((sum, s) => sum + s.score * s.weight, 0);
  const score = totalWeight > 0 ? round1(clamp(weightedSum / totalWeight, 0, 10)) : 0;

  const confidence = computeConfidenceLevel({
    hasConstructionYear: listing.constructionYear !== null,
    hasSurfaceM2: listing.surfaceM2 !== null,
    hasCondition: listing.condition !== "unknown",
    hasRegion: region !== null,
  });

  const riskFlags = computeRiskFlags(
    profile,
    renovationLevel,
    region,
    listing.constructionYear,
    listing.stationDistanceKm,
  );

  const strengths = deriveStrengths(subScores, prixAchatJpy, region);

  return {
    score,
    category: categorizeOpportunityScore(score),
    confidence,
    subScores,
    budget,
    scenarios,
    riskFlags,
    strengths,
    coverageIncomplete: subScores.length < candidates.length,
  };
}
