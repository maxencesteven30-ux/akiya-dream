import { getBuildingEraCode } from "@/lib/building-eras";
import type { MlitTransaction } from "@/lib/mlit/types";

// Phase AI — Comparable Transactions Engine.
//
// Une transaction dans la même préfecture, ou même la même municipalité,
// n'est pas automatiquement "comparable" à un akiya donné — un immeuble
// de bureaux à 75M JPY et une maison à 2,2M JPY dans la même rue ne
// racontent pas la même histoire. Ce moteur classe chaque transaction
// selon des critères documentés et testés, jamais un seuil arbitraire
// caché dans le code.

export type ComparabilityLevel =
  | "comparable"
  | "partiellement_comparable"
  | "non_comparable"
  | "insuffisant";

export interface ComparabilityResult {
  level: ComparabilityLevel;
  reasons: string[];
}

export interface ComparableSubject {
  municipalityCode: string;
  surfaceM2: number | null;
  constructionYear: number | null;
}

// Hypothèse de gestion explicite (pas une norme officielle MLIT) : sur un
// marché rural peu liquide comme celui d'un akiya, un écart de surface
// habitable supérieur à 40% rend la comparaison peu fiable. Centralisé
// ici, testé, à ajuster si l'usage réel montre qu'il est trop/pas assez
// strict — jamais dispersé en dur dans plusieurs fichiers.
export const SURFACE_TOLERANCE_RATIO = 0.4;

// Usages MLIT connus comme non résidentiels — un akiya est par
// définition un bien résidentiel ; comparer son prix à une transaction
// commerciale/industrielle/agricole serait trompeur, quels que soient la
// surface ou l'âge. Liste dérivée des valeurs réellement observées dans
// l'API (Phase AA/AC), pas une supposition.
const NON_RESIDENTIAL_USE_MARKERS = ["商業", "工業", "事務所", "農地"];

function isKnownNonResidentialUse(use: string | null): boolean {
  if (!use) return false;
  return NON_RESIDENTIAL_USE_MARKERS.some((marker) => use.includes(marker));
}

// Deux critères indépendants : surface proche (SURFACE_TOLERANCE_RATIO)
// et même ère de construction (lib/building-eras.ts, déjà utilisé
// ailleurs dans Akiya Dream pour la même raison : générations de normes
// sismiques/isolation). Les deux réunis → comparable ; un seul →
// partiellement comparable ; aucun → non comparable.
export function computeComparability(
  subject: ComparableSubject,
  transaction: MlitTransaction,
): ComparabilityResult {
  if (transaction.municipalityCode !== subject.municipalityCode) {
    return { level: "non_comparable", reasons: ["Municipalité différente"] };
  }

  if (isKnownNonResidentialUse(transaction.use)) {
    return { level: "non_comparable", reasons: [`Usage non résidentiel (${transaction.use})`] };
  }

  if (subject.surfaceM2 === null || subject.constructionYear === null) {
    return {
      level: "insuffisant",
      reasons: ["Surface ou année de construction du bien à évaluer non renseignée"],
    };
  }

  if (transaction.totalFloorAreaM2 === null || transaction.buildingYear === null) {
    return { level: "insuffisant", reasons: ["Transaction incomplète (surface ou année manquante)"] };
  }

  const reasons: string[] = [];
  let matchingCriteria = 0;

  const surfaceDeltaRatio =
    Math.abs(transaction.totalFloorAreaM2 - subject.surfaceM2) / subject.surfaceM2;
  if (surfaceDeltaRatio <= SURFACE_TOLERANCE_RATIO) {
    matchingCriteria += 1;
  } else {
    reasons.push(`Écart de surface important (${Math.round(surfaceDeltaRatio * 100)}%)`);
  }

  const sameEra =
    getBuildingEraCode(transaction.buildingYear) === getBuildingEraCode(subject.constructionYear);
  if (sameEra) {
    matchingCriteria += 1;
  } else {
    reasons.push("Ère de construction différente (normes sismiques/isolation)");
  }

  if (matchingCriteria === 2) {
    return { level: "comparable", reasons: ["Même municipalité, surface et ère de construction proches"] };
  }
  if (matchingCriteria === 1) {
    return { level: "partiellement_comparable", reasons };
  }
  return { level: "non_comparable", reasons };
}

// Section 8 de la mission : ne jamais transformer des comparables en
// estimation automatique du prix. MarketComparison décrit ce que les
// données permettent de dire, jamais "voici la vraie valeur".
export interface MarketComparison {
  totalTransactions: number;
  comparableCount: number;
  partiallyComparableCount: number;
  periodsCovered: string[];
  // Écart min/max des prix des transactions réellement comparables —
  // null si aucune n'est comparable.
  priceDispersionJpy: { minJpy: number; maxJpy: number } | null;
  missingDataCount: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  limits: string[];
}

const HIGH_CONFIDENCE_MIN_COMPARABLES = 3;
const MEDIUM_CONFIDENCE_MIN_COMPARABLES = 1;

export function computeMarketComparison(
  subject: ComparableSubject,
  transactions: MlitTransaction[],
): MarketComparison {
  const classified = transactions.map((t) => ({ transaction: t, result: computeComparability(subject, t) }));

  const comparable = classified.filter((c) => c.result.level === "comparable");
  const partial = classified.filter((c) => c.result.level === "partiellement_comparable");
  const insufficient = classified.filter((c) => c.result.level === "insuffisant");

  const comparablePrices = comparable.map((c) => c.transaction.tradePriceJpy);
  const priceDispersionJpy =
    comparablePrices.length > 0
      ? { minJpy: Math.min(...comparablePrices), maxJpy: Math.max(...comparablePrices) }
      : null;

  const confidence: MarketComparison["confidence"] =
    comparable.length >= HIGH_CONFIDENCE_MIN_COMPARABLES
      ? "HIGH"
      : comparable.length >= MEDIUM_CONFIDENCE_MIN_COMPARABLES
        ? "MEDIUM"
        : "LOW";

  const limits: string[] = [];
  if (transactions.length === 0) limits.push("Aucune transaction disponible pour cette municipalité/période.");
  if (comparable.length === 0 && transactions.length > 0) {
    limits.push("Aucune transaction réellement comparable parmi celles disponibles.");
  }
  if (insufficient.length > 0) {
    limits.push(`${insufficient.length} transaction(s) écartée(s) faute de données suffisantes.`);
  }
  if (comparable.length > 0 && comparable.length < HIGH_CONFIDENCE_MIN_COMPARABLES) {
    limits.push("Trop peu de transactions comparables pour une conclusion forte.");
  }

  return {
    totalTransactions: transactions.length,
    comparableCount: comparable.length,
    partiallyComparableCount: partial.length,
    periodsCovered: [...new Set(transactions.map((t) => t.period))],
    priceDispersionJpy,
    missingDataCount: insufficient.length,
    confidence,
    limits,
  };
}
