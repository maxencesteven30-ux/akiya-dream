import {
  computeBudget,
  computeBudgetScenarios,
  computeBudgetVerdict,
  computeMaxAffordablePriceJpy,
  computeRiskFlags,
  EUR_JPY_RATE,
  type BudgetBreakdown,
  type BudgetScenario,
  type BudgetVerdict,
  type RiskFlag,
} from "@/lib/calculations";
import { getBuildingEraCode } from "@/lib/building-eras";
import { formatJpy } from "@/lib/format";
import type {
  BudgetVerdictLevel,
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

// -- Confiance : explication distincte du score (section 14) ----------------

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

function buildConfidenceExplanation(signals: {
  hasConstructionYear: boolean;
  hasSurfaceM2: boolean;
  hasCondition: boolean;
  hasRegion: boolean;
}): string {
  const known = ["le prix"];
  if (signals.hasConstructionYear) known.push("l'année");
  if (signals.hasSurfaceM2) known.push("la surface");
  if (signals.hasCondition) known.push("l'état");
  if (signals.hasRegion) known.push("la région");

  const list = capitalize(joinList(known));
  const allKnown = known.length === 5;

  return allKnown
    ? `${list} connus. Le niveau de détail disponible est complet pour ce bien.`
    : `${list} connu${known.length > 1 ? "s" : ""}. Certaines caractéristiques du bien restent inconnues, ce qui limite la fiabilité de la note.`;
}

// -- Analyse automatique (section 12) : assemblage déterministe -------------
// Construit une phrase uniquement à partir des sous-scores déjà calculés,
// aucune génération libre — seulement des règles à seuils fixes.

function generateOpportunityNarrative(subScores: OpportunitySubScore[]): string {
  const byKey = Object.fromEntries(subScores.map((s) => [s.key, s])) as Partial<
    Record<OpportunitySubScoreKey, OpportunitySubScore>
  >;
  const clauses: string[] = [];

  if (byKey.prix) {
    clauses.push(
      byKey.prix.score >= 6.5
        ? "le prix demandé est inférieur à la référence régionale"
        : byKey.prix.score <= 3.5
          ? "le prix demandé est supérieur à la référence régionale"
          : "le prix demandé est proche de la référence régionale",
    );
  }

  if (byKey.travaux) {
    clauses.push(
      byKey.travaux.score >= 6.5
        ? "le niveau de travaux reste compatible avec le prix d'achat"
        : byKey.travaux.score <= 3.5
          ? "le coût estimé des travaux réduit fortement l'intérêt économique du projet"
          : "le coût des travaux représente une part notable du projet",
    );
  }

  if (byKey.anciennete && byKey.anciennete.score <= 3) {
    clauses.push("l'ancienneté du bien constitue un point de vigilance");
  }

  if (byKey.etat && byKey.etat.score <= 4) {
    clauses.push("l'état déclaré du bien nécessite des travaux importants");
  }

  if (clauses.length === 0) {
    return "Données insuffisantes pour construire une analyse détaillée.";
  }

  const firstSentence = `${capitalize(clauses.slice(0, 2).join(" et "))}.`;
  const remaining = clauses.slice(2);
  const secondSentence = remaining.length > 0 ? `${capitalize(remaining.join(", "))}.` : "";

  return [firstSentence, secondSentence].filter(Boolean).join(" ");
}

// -- Prix maximum finançable (section 5-6) -----------------------------------
// Wrapper EUR -> JPY autour de l'inverse financier exact de computeBudget
// (lib/calculations.ts). Aucune nouvelle règle financière : mêmes constantes,
// même moteur.

export function computeMaxAffordablePrice(
  profile: BuyerProfile,
  travauxJpy: number,
  capitalDisponibleEur: number,
  reserveSecuriteEur: number,
): number | null {
  const budgetDisponibleEur = capitalDisponibleEur - reserveSecuriteEur;
  const budgetCibleJpy = budgetDisponibleEur * EUR_JPY_RATE;
  return computeMaxAffordablePriceJpy(budgetCibleJpy, profile, travauxJpy);
}

// -- Analyse de sensibilité et prix attractif (section 7-8) ------------------
// Pas de formule fermée : le score n'est pas garanti monotone en fonction du
// prix (le sous-score Prix baisse quand le prix augmente, mais le sous-score
// Travaux augmente puisqu'un même montant de travaux pèse proportionnellement
// moins face à un prix plus élevé). La méthode la plus robuste et la plus
// honnête consiste à rejouer le moteur réel (computeOpportunityScore) à
// plusieurs prix candidats, jamais à inventer une inversion algébrique.

const SENSITIVITY_DEFAULT_DELTAS_PERCENT = [-30, -20, -10, 0, 10, 20, 30];
const SENSITIVITY_PRICE_FLOOR_JPY = 100_000;
const SENSITIVITY_ROUNDING_STEP_JPY = 10_000;

export function computePriceSensitivity(
  input: OpportunityInput,
  deltasPercent: number[] = SENSITIVITY_DEFAULT_DELTAS_PERCENT,
): PriceSensitivityPoint[] {
  const seen = new Set<number>();
  const points: PriceSensitivityPoint[] = [];

  for (const delta of deltasPercent) {
    const rawPrice = input.prixAchatJpy * (1 + delta / 100);
    const priceJpy = Math.max(
      SENSITIVITY_PRICE_FLOOR_JPY,
      Math.round(rawPrice / SENSITIVITY_ROUNDING_STEP_JPY) * SENSITIVITY_ROUNDING_STEP_JPY,
    );
    if (seen.has(priceJpy)) continue;
    seen.add(priceJpy);

    const result = computeOpportunityScoreCore({ ...input, prixAchatJpy: priceJpy });
    points.push({ prixJpy: priceJpy, score: result.score, category: result.category });
  }

  return points.sort((a, b) => a.prixJpy - b.prixJpy);
}

const ATTRACTIVE_PRICE_TARGET_SCORE = 7; // seuil "bonne opportunité" (catégorie ≥ bonne)
const ATTRACTIVE_PRICE_STEP_JPY = 100_000;
const ATTRACTIVE_PRICE_MIN_RATIO = 0.3;

export function findAttractivePrice(
  input: OpportunityInput,
  targetScore: number = ATTRACTIVE_PRICE_TARGET_SCORE,
  stepJpy: number = ATTRACTIVE_PRICE_STEP_JPY,
  minRatio: number = ATTRACTIVE_PRICE_MIN_RATIO,
): number | null {
  const currentScore = computeOpportunityScoreCore(input).score;
  if (currentScore >= targetScore) return input.prixAchatJpy;

  const floorJpy = Math.max(SENSITIVITY_PRICE_FLOOR_JPY, input.prixAchatJpy * minRatio);

  for (let price = input.prixAchatJpy - stepJpy; price >= floorJpy; price -= stepJpy) {
    const result = computeOpportunityScoreCore({ ...input, prixAchatJpy: price });
    if (result.score >= targetScore) return price;
  }

  return null;
}

function buildNegotiationMessage(
  prixAchatJpy: number,
  attractivePriceJpy: number | null,
): string | null {
  if (attractivePriceJpy === null || attractivePriceJpy >= prixAchatJpy) return null;
  return (
    `Une négociation vers ${formatJpy(attractivePriceJpy)} améliorerait sensiblement ` +
    "l'attractivité financière du projet."
  );
}

// -- Assemblage complet -------------------------------------------------------

export interface OpportunityInput {
  prixAchatJpy: number;
  profile: BuyerProfile;
  renovationLevel: RenovationLevel;
  region: Region | null;
  listing: RealListing;
  capitalDisponibleEur?: number | null;
  reserveSecuriteEur?: number | null;
}

export interface PriceAnalysis {
  prixAchatJpy: number;
  referenceRegionaleJpy: number | null;
  ecartPercent: number | null;
}

export type FeasibilityLevel = "compatible" | "tendu" | "insuffisant";

export const FEASIBILITY_LABELS: Record<FeasibilityLevel, string> = {
  compatible: "🟢 Compatible avec ton budget",
  tendu: "🟠 Tendu par rapport à ton budget",
  insuffisant: "🔴 Projet supérieur à ton budget",
};

function feasibilityFromVerdict(verdict: BudgetVerdictLevel): FeasibilityLevel {
  if (verdict === "viable") return "compatible";
  if (verdict === "tendu") return "tendu";
  return "insuffisant";
}

export interface PriceSensitivityPoint {
  prixJpy: number;
  score: number;
  category: OpportunityCategory;
}

export interface PriceTargets {
  maxAffordablePriceJpy: number | null;
  attractivePriceJpy: number | null;
  negotiationMessage: string | null;
}

export interface OpportunityResult {
  score: number;
  category: OpportunityCategory;
  confidence: OpportunityConfidenceLevel;
  confidenceExplanation: string;
  subScores: OpportunitySubScore[];
  budget: BudgetBreakdown;
  scenarios: BudgetScenario[];
  riskFlags: RiskFlag[];
  strengths: string[];
  coverageIncomplete: boolean;
  priceAnalysis: PriceAnalysis;
  budgetVerdict: BudgetVerdict | null;
  feasibility: FeasibilityLevel | null;
  narrative: string;
  priceTargets: PriceTargets;
  sensitivity: PriceSensitivityPoint[];
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

type OpportunityCoreResult = Omit<OpportunityResult, "priceTargets" | "sensitivity">;

// Calcul "cœur" : score, sous-scores, budget, faisabilité, narratif. Séparé
// du calcul public pour permettre à computePriceSensitivity/findAttractivePrice
// de rejouer ce cœur à différents prix SANS déclencher récursivement le calcul
// de sensibilité lui-même (qui, sinon, se rappellerait indéfiniment).
function computeOpportunityScoreCore(input: OpportunityInput): OpportunityCoreResult {
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
  const category = categorizeOpportunityScore(score);

  const confidenceSignals = {
    hasConstructionYear: listing.constructionYear !== null,
    hasSurfaceM2: listing.surfaceM2 !== null,
    hasCondition: listing.condition !== "unknown",
    hasRegion: region !== null,
  };
  const confidence = computeConfidenceLevel(confidenceSignals);
  const confidenceExplanation = buildConfidenceExplanation(confidenceSignals);

  const riskFlags = computeRiskFlags(
    profile,
    renovationLevel,
    region,
    listing.constructionYear,
    listing.stationDistanceKm,
  );

  const strengths = deriveStrengths(subScores, prixAchatJpy, region);

  const priceAnalysis: PriceAnalysis = {
    prixAchatJpy,
    referenceRegionaleJpy: region?.medianPriceJpy ?? null,
    ecartPercent:
      region && region.medianPriceJpy
        ? Math.round(((prixAchatJpy - region.medianPriceJpy) / region.medianPriceJpy) * 100)
        : null,
  };

  const budgetVerdict =
    input.capitalDisponibleEur != null && input.reserveSecuriteEur != null
      ? computeBudgetVerdict(budget.totalProjetEur, input.capitalDisponibleEur, input.reserveSecuriteEur)
      : null;
  const feasibility = budgetVerdict ? feasibilityFromVerdict(budgetVerdict.verdict) : null;

  const narrative = generateOpportunityNarrative(subScores);

  return {
    score,
    category,
    confidence,
    confidenceExplanation,
    subScores,
    budget,
    scenarios,
    riskFlags,
    strengths,
    coverageIncomplete: subScores.length < candidates.length,
    priceAnalysis,
    budgetVerdict,
    feasibility,
    narrative,
  };
}

export function computeOpportunityScore(input: OpportunityInput): OpportunityResult {
  const core = computeOpportunityScoreCore(input);

  const sensitivity = computePriceSensitivity(input);

  const travauxJpy = core.budget.travauxJpy;
  const maxAffordablePriceJpy =
    input.capitalDisponibleEur != null && input.reserveSecuriteEur != null
      ? computeMaxAffordablePrice(
          input.profile,
          travauxJpy,
          input.capitalDisponibleEur,
          input.reserveSecuriteEur,
        )
      : null;

  const attractivePriceJpy = findAttractivePrice(input);
  const negotiationMessage = buildNegotiationMessage(input.prixAchatJpy, attractivePriceJpy);

  return {
    ...core,
    priceTargets: {
      maxAffordablePriceJpy,
      attractivePriceJpy,
      negotiationMessage,
    },
    sensitivity,
  };
}
