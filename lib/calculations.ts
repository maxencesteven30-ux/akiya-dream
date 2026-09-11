import { EUR_JPY_RATE, jpyToEur } from "@/lib/data";
import { getBuildingEraForYear } from "@/lib/building-eras";
import type {
  BudgetVerdictLevel,
  BuildingEraCode,
  BuyerProfile,
  Region,
  RenovationLevel,
} from "@/lib/types";

const AGENCY_FLAT_FEE_JPY = 330_000;
const AGENCY_FLAT_THRESHOLD_JPY = 8_000_000;
const AGENCY_RATE = 0.03;
const AGENCY_BASE_JPY = 60_000;
const AGENCY_VAT_RATE = 0.1;

const SHIHO_SHOSHI_JPY = 150_000;
const ACQUISITION_TAX_RATE = 0.045;

const SCI_SETUP_JPY = 350_000;
const GK_SETUP_JPY = 250_000;

const RENOVATION_BUDGET_JPY: Record<RenovationLevel, number> = {
  leger: 3_000_000,
  standard: 8_000_000,
  lourd: 15_000_000,
};

export function computeAgencyFee(prixAchatJpy: number): number {
  if (prixAchatJpy <= AGENCY_FLAT_THRESHOLD_JPY) {
    return AGENCY_FLAT_FEE_JPY;
  }
  const feeHt = prixAchatJpy * AGENCY_RATE + AGENCY_BASE_JPY;
  return feeHt * (1 + AGENCY_VAT_RATE);
}

export function computeLegalSetupFee(profile: BuyerProfile): number {
  if (profile === "duo") return SCI_SETUP_JPY;
  if (profile === "investisseur") return GK_SETUP_JPY;
  return 0;
}

export interface AcquisitionFees {
  agence: number;
  juriste: number;
  taxes: number;
  montageJuridique: number;
  total: number;
}

export function computeAcquisitionFees(
  prixAchatJpy: number,
  profile: BuyerProfile,
): AcquisitionFees {
  const agence = computeAgencyFee(prixAchatJpy);
  const juriste = SHIHO_SHOSHI_JPY;
  const taxes = prixAchatJpy * ACQUISITION_TAX_RATE;
  const montageJuridique = computeLegalSetupFee(profile);

  return {
    agence,
    juriste,
    taxes,
    montageJuridique,
    total: agence + juriste + taxes + montageJuridique,
  };
}

export function computeRenovationBudget(niveauTravaux: RenovationLevel): number {
  return RENOVATION_BUDGET_JPY[niveauTravaux];
}

// Affinage "chirurgical" du forfait travaux quand l'année de construction ET
// la surface habitable du bien réel sont connues : isolation + HVAC calculés
// au m² selon l'ère du bâtiment, plus une majoration structurelle forfaitaire
// (mise aux normes sismiques) pour les biens PRE_1981. Ces montants viennent
// tels quels du jeu de données building_eras.json — aucune donnée inventée,
// aucun multiplicateur ajouté par rapport à la source.
export interface SurfaceBasedRenovation {
  eraCode: BuildingEraCode;
  isolationJpy: number;
  hvacJpy: number;
  majorationStructurelleJpy: number;
  totalJpy: number;
}

export function computeSurfaceBasedRenovation(
  constructionYear: number,
  surfaceM2: number,
): SurfaceBasedRenovation {
  const era = getBuildingEraForYear(constructionYear);
  const isolationJpy = surfaceM2 * era.insulationCostPerSqmJpy;
  const hvacJpy = surfaceM2 * era.hvacCostPerSqmJpy;
  const majorationStructurelleJpy =
    era.code === "PRE_1981" ? era.estimatedStructuralSurchargeJpy : 0;

  return {
    eraCode: era.code,
    isolationJpy,
    hvacJpy,
    majorationStructurelleJpy,
    totalJpy: isolationJpy + hvacJpy + majorationStructurelleJpy,
  };
}

// Suggestion de prix de base à partir de la surface et de l'ère du bâtiment
// (Average_Price_Per_Sqm_JPY du jeu de données). Reste une proposition
// affichée à l'utilisateur : ne remplace jamais silencieusement le prix
// choisi via le slider.
export function computeEstimatedPriceFromSurface(
  constructionYear: number,
  surfaceM2: number,
): number {
  const era = getBuildingEraForYear(constructionYear);
  return era.avgPricePerSqmJpy * surfaceM2;
}

export interface BudgetBreakdown {
  prixAchatJpy: number;
  acquisitionFees: AcquisitionFees;
  travauxJpy: number;
  totalAcquisitionJpy: number;
  totalProjetJpy: number;
  totalProjetEur: number;
  surfaceBasedRenovation: SurfaceBasedRenovation | null;
}

export interface RenovationRefinement {
  constructionYear: number;
  surfaceM2: number;
}

export function computeBudget(
  prixAchatJpy: number,
  profile: BuyerProfile,
  niveauTravaux: RenovationLevel,
  refinement?: RenovationRefinement | null,
): BudgetBreakdown {
  const acquisitionFees = computeAcquisitionFees(prixAchatJpy, profile);
  const surfaceBasedRenovation = refinement
    ? computeSurfaceBasedRenovation(refinement.constructionYear, refinement.surfaceM2)
    : null;
  const travauxJpy = surfaceBasedRenovation
    ? surfaceBasedRenovation.totalJpy
    : computeRenovationBudget(niveauTravaux);
  const totalAcquisitionJpy = prixAchatJpy + acquisitionFees.total;
  const totalProjetJpy = totalAcquisitionJpy + travauxJpy;

  return {
    prixAchatJpy,
    acquisitionFees,
    travauxJpy,
    totalAcquisitionJpy,
    totalProjetJpy,
    totalProjetEur: jpyToEur(totalProjetJpy),
    surfaceBasedRenovation,
  };
}

// L'estimation travaux de computeRenovationBudget() est l'hypothèse
// "optimiste" (aucun dépassement). Réaliste et prudent appliquent une
// marge de dépassement explicite, alignée sur l'exemple chiffré du
// cahier des charges (8,0M -> 8,8M -> 9,6M, soit +0% / +10% / +20%).
export type ScenarioLabel = "optimiste" | "realiste" | "prudent";

const SCENARIO_MULTIPLIERS: Record<ScenarioLabel, number> = {
  optimiste: 1.0,
  realiste: 1.1,
  prudent: 1.2,
};

export interface RenovationScenarios {
  optimisteJpy: number;
  realisteJpy: number;
  prudentJpy: number;
}

export function computeRenovationScenarios(
  niveauTravaux: RenovationLevel,
): RenovationScenarios {
  const base = computeRenovationBudget(niveauTravaux);
  return {
    optimisteJpy: base * SCENARIO_MULTIPLIERS.optimiste,
    realisteJpy: base * SCENARIO_MULTIPLIERS.realiste,
    prudentJpy: base * SCENARIO_MULTIPLIERS.prudent,
  };
}

export interface BudgetScenario {
  label: ScenarioLabel;
  multiplier: number;
  travauxJpy: number;
  totalProjetJpy: number;
  totalProjetEur: number;
}

export function computeBudgetScenarios(
  prixAchatJpy: number,
  profile: BuyerProfile,
  niveauTravaux: RenovationLevel,
  refinement?: RenovationRefinement | null,
): BudgetScenario[] {
  const acquisitionFees = computeAcquisitionFees(prixAchatJpy, profile);
  const totalAcquisitionJpy = prixAchatJpy + acquisitionFees.total;
  const baseTravauxJpy = refinement
    ? computeSurfaceBasedRenovation(refinement.constructionYear, refinement.surfaceM2).totalJpy
    : computeRenovationBudget(niveauTravaux);

  const travauxByLabel: Record<ScenarioLabel, number> = {
    optimiste: baseTravauxJpy * SCENARIO_MULTIPLIERS.optimiste,
    realiste: baseTravauxJpy * SCENARIO_MULTIPLIERS.realiste,
    prudent: baseTravauxJpy * SCENARIO_MULTIPLIERS.prudent,
  };

  return (Object.keys(SCENARIO_MULTIPLIERS) as ScenarioLabel[]).map((label) => {
    const travauxJpy = travauxByLabel[label];
    const totalProjetJpy = totalAcquisitionJpy + travauxJpy;
    return {
      label,
      multiplier: SCENARIO_MULTIPLIERS[label],
      travauxJpy,
      totalProjetJpy,
      totalProjetEur: jpyToEur(totalProjetJpy),
    };
  });
}

const TAXABLE_VALUE_RATIO = 0.5;
const PROPERTY_TAX_RATE = 0.014;
const CITY_PLANNING_TAX_RATE = 0.003;
const INSURANCE_JPY = 50_000;
const MANAGEMENT_MAINTENANCE_JPY = 100_000;
const GK_ACCOUNTING_JPY = 250_000;
const OWNERSHIP_HORIZON_YEARS = 10;

export interface AnnualCostsBreakdown {
  valeurFiscaleEstimeeJpy: number;
  taxeFonciereJpy: number;
  taxeUrbanismeJpy: number;
  assuranceJpy: number;
  gestionEntretienJpy: number;
  comptableJpy: number;
  totalAnnuelJpy: number;
  coutDixAnsJpy: number;
  coutDixAnsEur: number;
}

export function calculateAnnualCosts(
  prixAchatJpy: number,
  profile: BuyerProfile,
): AnnualCostsBreakdown {
  const valeurFiscaleEstimeeJpy = prixAchatJpy * TAXABLE_VALUE_RATIO;
  const taxeFonciereJpy = valeurFiscaleEstimeeJpy * PROPERTY_TAX_RATE;
  const taxeUrbanismeJpy = valeurFiscaleEstimeeJpy * CITY_PLANNING_TAX_RATE;
  const assuranceJpy = INSURANCE_JPY;
  const gestionEntretienJpy = MANAGEMENT_MAINTENANCE_JPY;
  const comptableJpy = profile === "investisseur" ? GK_ACCOUNTING_JPY : 0;

  const totalAnnuelJpy =
    taxeFonciereJpy +
    taxeUrbanismeJpy +
    assuranceJpy +
    gestionEntretienJpy +
    comptableJpy;
  const coutDixAnsJpy = totalAnnuelJpy * OWNERSHIP_HORIZON_YEARS;

  return {
    valeurFiscaleEstimeeJpy,
    taxeFonciereJpy,
    taxeUrbanismeJpy,
    assuranceJpy,
    gestionEntretienJpy,
    comptableJpy,
    totalAnnuelJpy,
    coutDixAnsJpy,
    coutDixAnsEur: jpyToEur(coutDixAnsJpy),
  };
}

// Seuil déterministe séparant un projet "viable" d'un projet "tendu" :
// marge (budget disponible - budget nécessaire) rapportée au budget nécessaire.
// Aucune source externe ne documente ce seuil : c'est une règle de gestion
// explicite, pas une donnée financière ou juridique.
const VIABLE_MARGIN_RATIO = 0.1;

export interface BudgetVerdict {
  budgetNecessaireEur: number;
  budgetDisponibleEur: number;
  margeEur: number;
  verdict: BudgetVerdictLevel;
}

export function computeBudgetVerdict(
  totalProjetEur: number,
  capitalDisponibleEur: number,
  reserveSecuriteEur: number,
): BudgetVerdict {
  const budgetDisponibleEur = capitalDisponibleEur - reserveSecuriteEur;
  const margeEur = budgetDisponibleEur - totalProjetEur;

  let verdict: BudgetVerdictLevel;
  if (margeEur < 0) {
    verdict = "non_viable";
  } else if (margeEur / totalProjetEur < VIABLE_MARGIN_RATIO) {
    verdict = "tendu";
  } else {
    verdict = "viable";
  }

  return {
    budgetNecessaireEur: totalProjetEur,
    budgetDisponibleEur,
    margeEur,
    verdict,
  };
}

// Seuil déterministe : part du parc antérieur à 1981 (norme antisismique
// japonaise pré-Shin-Taishin) à partir de laquelle on recommande une
// vérification technique. Donnée régionale réelle (Supabase), seuil
// explicite posé ici, pas une donnée mesurée elle-même.
const OLD_CONSTRUCTION_THRESHOLD_PERCENT = 40;

export interface RiskFlag {
  key: string;
  message: string;
}

const RISK_DISCLAIMER_SUFFIX = "à vérifier avec un professionnel";

// Distance à partir de laquelle on signale un risque d'enclavement /
// dépendance à la voiture. Seuil explicite posé ici, appliqué
// uniquement quand l'utilisateur fournit une distance réelle mesurée
// pour SON bien (donnée qu'il apporte lui-même, pas une moyenne).
const ISOLATED_STATION_DISTANCE_KM = 15;

export function computeRiskFlags(
  profile: BuyerProfile,
  renovationLevel: RenovationLevel,
  region: Region | null,
  constructionYear?: number | null,
  stationDistanceKm?: number | null,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (profile === "duo") {
    flags.push({
      key: "duo-ownership",
      message:
        `Point de vigilance — à deux, clarifiez juridiquement la propriété et ` +
        `la répartition avant l'achat (${RISK_DISCLAIMER_SUFFIX})`,
    });
  }

  if (renovationLevel === "lourd") {
    flags.push({
      key: "heavy-renovation",
      message:
        "Point de vigilance — rénovation lourde : prévoyez une marge " +
        "d'imprévus (voir le scénario prudent ci-dessus).",
    });
  }

  // L'année réelle du bien (fournie par l'utilisateur) est plus précise
  // que le pourcentage régional agrégé : elle prend le pas quand elle
  // est disponible, plutôt que d'empiler les deux signaux.
  if (constructionYear !== undefined && constructionYear !== null) {
    if (constructionYear < 1981) {
      flags.push({
        key: "old-construction-house",
        message:
          `Point de vigilance — ce bien daterait de ${constructionYear} ` +
          `(antérieur à 1981) : une vérification technique (séisme, amiante) ` +
          `est recommandée (${RISK_DISCLAIMER_SUFFIX})`,
      });
    }
  } else if (region && region.pre1981Percent >= OLD_CONSTRUCTION_THRESHOLD_PERCENT) {
    const name = region.prefecture.replace(/_/g, " ");
    flags.push({
      key: "old-construction",
      message:
        `Point de vigilance — ${region.pre1981Percent}% du parc de ${name} est ` +
        `antérieur à 1981 : une vérification technique (séisme, amiante) est ` +
        `recommandée (${RISK_DISCLAIMER_SUFFIX})`,
    });
  }

  // Idem : une distance réelle mesurée pour ce bien précis remplace le
  // rappel générique par un signal plus concret.
  if (stationDistanceKm !== undefined && stationDistanceKm !== null) {
    if (stationDistanceKm >= ISOLATED_STATION_DISTANCE_KM) {
      flags.push({
        key: "isolated-station-distance",
        message:
          `Point de vigilance — ce bien est à ${stationDistanceKm} km de la gare ` +
          `la plus proche : vérifiez la dépendance à la voiture et l'accès aux ` +
          `services au quotidien.`,
      });
    }
  } else if (region) {
    flags.push({
      key: "rural-access",
      message:
        "Point de vigilance — vérifiez l'accès aux services (gare, commerces, " +
        "santé) et les transports avant de vous engager.",
    });
  }

  return flags;
}

export { EUR_JPY_RATE };
