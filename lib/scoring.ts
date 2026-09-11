import { jpyToEur } from "@/lib/data";
import type { Region, RegionAttributes } from "@/lib/types";

export type PreferenceChoice = "importe" | "peu_importe";
export type SnowPreference = "eviter" | "peu_importe" | "recherche";

export interface BudgetContext {
  capitalDisponibleEur: number;
  reserveSecuriteEur: number;
}

export interface RegionPreferences {
  coastal: PreferenceChoice;
  shinkansen: PreferenceChoice;
  rural: PreferenceChoice;
  snow: SnowPreference;
  budget: BudgetContext | null;
}

export interface CriterionResult {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  justification: string;
}

export interface RegionScore {
  region: Region;
  criteria: CriterionResult[];
  totalPoints: number;
  maxPoints: number;
  criteriaEvaluated: number;
  criteriaAvailable: number;
}

// Poids explicites (pas une mesure : une règle de gestion posée ici,
// documentée pour rester ajustable). Total si les 5 critères sont
// retenus par l'utilisateur : 100.
const WEIGHT_BUDGET = 30;
const WEIGHT_COASTAL = 20;
const WEIGHT_SHINKANSEN = 20;
const WEIGHT_RURAL = 15;
const WEIGHT_SNOW = 15;

export const MAX_CRITERIA_COUNT = 5;

// Bornes observées dans les 16 régions réelles de la base (2026-09),
// utilisées pour normaliser une valeur brute en score sur l'échelle du
// critère. Pas une norme nationale : le mieux/pire de notre échantillon.
const FOREST_PERCENT_MIN = 62.64; // Kumamoto
const FOREST_PERCENT_MAX = 81.12; // Gifu
const SNOWFALL_CM_MIN = 0; // Miyazaki
const SNOWFALL_CM_MAX = 669; // Aomori

// Un budget est jugé "confortable" si le disponible dépasse le prix
// médian d'au moins 30% (marge pour frais/travaux, chiffrés plus tard
// en Étape 3-4) ; "tendu" s'il couvre au moins le prix médian sans
// marge ; sinon 0 point. Seuils cohérents avec computeBudgetVerdict.
const BUDGET_COMFORTABLE_RATIO = 1.3;
const BUDGET_TIGHT_SCORE_SHARE = 0.6;

function scoreBudget(region: Region, budget: BudgetContext): CriterionResult {
  const disponibleEur = budget.capitalDisponibleEur - budget.reserveSecuriteEur;
  const prixMedianEur = jpyToEur(region.medianPriceJpy);
  const ratio = prixMedianEur > 0 ? disponibleEur / prixMedianEur : 0;

  let points: number;
  let justification: string;
  if (ratio >= BUDGET_COMFORTABLE_RATIO) {
    points = WEIGHT_BUDGET;
    justification = "Budget disponible confortable face au prix médian de cette région.";
  } else if (ratio >= 1) {
    points = Math.round(WEIGHT_BUDGET * BUDGET_TIGHT_SCORE_SHARE);
    justification = "Budget disponible couvre le prix médian, mais sans marge (frais et travaux non inclus, voir Étape 3-4).";
  } else {
    points = 0;
    justification = "Budget disponible inférieur au prix médian de cette région.";
  }

  return { key: "budget", label: "Budget", points, maxPoints: WEIGHT_BUDGET, justification };
}

function scoreCoastal(attributes: RegionAttributes): CriterionResult {
  const has = attributes.hasCoastline;
  const points = has === true ? WEIGHT_COASTAL : 0;
  const justification =
    has === null
      ? "Donnée indisponible pour cette région."
      : has
        ? "Préfecture avec façade maritime."
        : "Préfecture enclavée, sans façade maritime.";
  return { key: "coastal", label: "Façade maritime", points, maxPoints: WEIGHT_COASTAL, justification };
}

function scoreShinkansen(attributes: RegionAttributes): CriterionResult {
  const count = attributes.shinkansenStationCount;
  const points = count !== null && count > 0 ? WEIGHT_SHINKANSEN : 0;
  const justification =
    count === null
      ? "Donnée indisponible pour cette région."
      : count > 0
        ? `${count} gare${count > 1 ? "s" : ""} Shinkansen dans la préfecture.`
        : "Aucune gare Shinkansen dans la préfecture.";
  return {
    key: "shinkansen",
    label: "Accès Shinkansen",
    points,
    maxPoints: WEIGHT_SHINKANSEN,
    justification,
  };
}

function scoreRural(attributes: RegionAttributes): CriterionResult {
  const pct = attributes.forestAreaPercent;
  let points = 0;
  let justification = "Donnée indisponible pour cette région.";
  if (pct !== null) {
    const clamped = Math.min(Math.max(pct, FOREST_PERCENT_MIN), FOREST_PERCENT_MAX);
    const ratio = (clamped - FOREST_PERCENT_MIN) / (FOREST_PERCENT_MAX - FOREST_PERCENT_MIN);
    points = Math.round(WEIGHT_RURAL * ratio);
    justification = `${pct}% du territoire est boisé (échelle basée sur l'étendue observée : ${FOREST_PERCENT_MIN}%-${FOREST_PERCENT_MAX}% parmi nos régions).`;
  }
  return { key: "rural", label: "Cadre boisé / rural", points, maxPoints: WEIGHT_RURAL, justification };
}

function scoreSnow(attributes: RegionAttributes, preference: "eviter" | "recherche"): CriterionResult {
  const cm = attributes.avgAnnualSnowfallCm;
  let points = 0;
  let justification = "Donnée indisponible pour cette région.";
  if (cm !== null) {
    const clamped = Math.min(Math.max(cm, SNOWFALL_CM_MIN), SNOWFALL_CM_MAX);
    const snowRatio = (clamped - SNOWFALL_CM_MIN) / (SNOWFALL_CM_MAX - SNOWFALL_CM_MIN);
    const scoreRatio = preference === "eviter" ? 1 - snowRatio : snowRatio;
    points = Math.round(WEIGHT_SNOW * scoreRatio);
    justification = `${cm} cm de neige/an en moyenne (échelle basée sur ${SNOWFALL_CM_MIN}-${SNOWFALL_CM_MAX} cm observés).`;
  }
  return {
    key: "snow",
    label: preference === "eviter" ? "Peu de neige" : "Neige abondante",
    points,
    maxPoints: WEIGHT_SNOW,
    justification,
  };
}

export function scoreRegion(
  region: Region,
  attributes: RegionAttributes | undefined,
  preferences: RegionPreferences,
): RegionScore {
  const attrs: RegionAttributes = attributes ?? {
    hasCoastline: null,
    shinkansenStationCount: null,
    forestAreaPercent: null,
    avgAnnualSnowfallCm: null,
  };

  const criteria: CriterionResult[] = [];

  if (preferences.budget) {
    criteria.push(scoreBudget(region, preferences.budget));
  }
  if (preferences.coastal === "importe") {
    criteria.push(scoreCoastal(attrs));
  }
  if (preferences.shinkansen === "importe") {
    criteria.push(scoreShinkansen(attrs));
  }
  if (preferences.rural === "importe") {
    criteria.push(scoreRural(attrs));
  }
  if (preferences.snow !== "peu_importe") {
    criteria.push(scoreSnow(attrs, preferences.snow));
  }

  const totalPoints = criteria.reduce((sum, c) => sum + c.points, 0);
  const maxPoints = criteria.reduce((sum, c) => sum + c.maxPoints, 0);

  return {
    region,
    criteria,
    totalPoints,
    maxPoints,
    criteriaEvaluated: criteria.length,
    criteriaAvailable: MAX_CRITERIA_COUNT,
  };
}

export function scoreAllRegions(
  regions: Region[],
  attributesByName: Record<string, RegionAttributes>,
  preferences: RegionPreferences,
): RegionScore[] {
  return regions
    .map((region) => scoreRegion(region, attributesByName[region.prefecture], preferences))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}
