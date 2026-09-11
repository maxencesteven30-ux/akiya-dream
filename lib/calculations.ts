import { EUR_JPY_RATE, jpyToEur } from "@/lib/data";
import type { BudgetVerdictLevel, BuyerProfile, RenovationLevel } from "@/lib/types";

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

export interface BudgetBreakdown {
  prixAchatJpy: number;
  acquisitionFees: AcquisitionFees;
  travauxJpy: number;
  totalAcquisitionJpy: number;
  totalProjetJpy: number;
  totalProjetEur: number;
}

export function computeBudget(
  prixAchatJpy: number,
  profile: BuyerProfile,
  niveauTravaux: RenovationLevel,
): BudgetBreakdown {
  const acquisitionFees = computeAcquisitionFees(prixAchatJpy, profile);
  const travauxJpy = computeRenovationBudget(niveauTravaux);
  const totalAcquisitionJpy = prixAchatJpy + acquisitionFees.total;
  const totalProjetJpy = totalAcquisitionJpy + travauxJpy;

  return {
    prixAchatJpy,
    acquisitionFees,
    travauxJpy,
    totalAcquisitionJpy,
    totalProjetJpy,
    totalProjetEur: jpyToEur(totalProjetJpy),
  };
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

export { EUR_JPY_RATE };
