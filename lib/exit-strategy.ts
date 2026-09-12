import { computeAgencyFee } from "@/lib/calculations";
import type {
  ExitStrategy,
  ExitStrategyProfile,
  MinpakuChecklistState,
  ProjectionHorizonYears,
} from "@/lib/types";

// Phase Y — Exit Strategy : "et si dans 10 ans je veux partir ?".
//
// Aucune valeur future du bien n'est inventée : les simulations de
// revente et de location partent exclusivement d'hypothèses saisies par
// l'utilisateur (prix de revente, loyer, taux d'occupation), jamais d'une
// estimation calculée par l'application. Présentées comme des
// simulations d'hypothèse, pas des prédictions.

export function createEmptyExitStrategyProfile(): ExitStrategyProfile {
  return {
    strategy: null,
    horizonYears: 10,
    resaleValueJpy: null,
    monthlyRentJpy: null,
    occupancyRatePercent: null,
    demolitionCostJpy: null,
    minpakuChecklist: {},
  };
}

export const EXIT_STRATEGY_LABELS: Record<ExitStrategy, string> = {
  garder: "🏠 Je veux la garder",
  louer: "💰 Je veux la louer",
  minpaku: "🏨 Je pourrais éventuellement faire du minpaku",
  revendre: "🔄 Je pourrais la revendre",
  demolir: "💥 Je pourrais démolir et vendre le terrain",
};

export const HORIZON_OPTIONS: ProjectionHorizonYears[] = [10, 20, 30];

// Y.2 — Simulation de revente hypothétique.
export interface ResaleSimulation {
  capitalInvestiJpy: number;
  fraisCumulesJpy: number;
  fraisSortieJpy: number;
  produitVenteJpy: number;
  coutNetJpy: number;
}

// fraisSortieJpy réutilise la même formule que la commission d'agence à
// l'achat (computeAgencyFee, régime légal identique à l'achat et à la
// vente) — pas une nouvelle hypothèse inventée pour la sortie.
export function computeResaleSimulation(input: {
  capitalInvestiJpy: number;
  totalAnnuelJpy: number;
  horizonYears: ProjectionHorizonYears;
  resaleValueJpy: number;
}): ResaleSimulation {
  const fraisCumulesJpy = input.totalAnnuelJpy * input.horizonYears;
  const fraisSortieJpy = computeAgencyFee(input.resaleValueJpy);
  const produitVenteJpy = input.resaleValueJpy - fraisSortieJpy;
  const coutNetJpy = input.capitalInvestiJpy + fraisCumulesJpy - produitVenteJpy;
  return {
    capitalInvestiJpy: input.capitalInvestiJpy,
    fraisCumulesJpy,
    fraisSortieJpy,
    produitVenteJpy,
    coutNetJpy,
  };
}

// Y.3 — Simulation de location longue durée (hypothétique, avant impôt —
// la fiscalité dépend de la situation personnelle et n'est jamais
// calculée automatiquement ici).
export interface RentalSimulation {
  revenuAnnuelBrutJpy: number;
  rendementBrutPercent: number;
  coutsAnnuelsJpy: number;
  cashFlowEstimeJpy: number;
}

export function computeRentalSimulation(input: {
  prixAchatJpy: number;
  monthlyRentJpy: number;
  occupancyRatePercent: number;
  totalAnnuelJpy: number;
}): RentalSimulation {
  const revenuAnnuelBrutJpy = input.monthlyRentJpy * 12 * (input.occupancyRatePercent / 100);
  const rendementBrutPercent =
    input.prixAchatJpy > 0 ? (revenuAnnuelBrutJpy / input.prixAchatJpy) * 100 : 0;
  const cashFlowEstimeJpy = revenuAnnuelBrutJpy - input.totalAnnuelJpy;
  return {
    revenuAnnuelBrutJpy,
    rendementBrutPercent,
    coutsAnnuelsJpy: input.totalAnnuelJpy,
    cashFlowEstimeJpy,
  };
}

export const RENTAL_FISCALITY_DISCLAIMER =
  "Fiscalité non calculée ici : l'imposition des revenus locatifs dépend du régime fiscal du propriétaire (résident ou non-résident) et de sa situation personnelle — à établir avec un fiscaliste (zeirishi).";

// Y.4 — Minpaku : une checklist déclarative, jamais un calcul de
// rentabilité ("pas de ROI Airbnb magique").
export interface MinpakuChecklistItemDef {
  id: string;
  label: string;
}

export const MINPAKU_CHECKLIST_TEMPLATE: MinpakuChecklistItemDef[] = [
  { id: "minpaku_zone", label: "Zone compatible avec le minpaku" },
  { id: "minpaku_reglement_municipal", label: "Règlement municipal vérifié" },
  { id: "minpaku_equipement", label: "Équipement conforme (sécurité, accessibilité)" },
  { id: "minpaku_habitation", label: "Statut d'habitation compatible" },
  { id: "minpaku_declaration", label: "Déclaration effectuée (notification à la préfecture/mairie)" },
  { id: "minpaku_gestion", label: "Gestion opérationnelle organisée (accueil, ménage, urgences)" },
  { id: "minpaku_restrictions_locales", label: "Restrictions locales complémentaires vérifiées" },
  { id: "minpaku_plafond_180_jours", label: "Plafond de 180 jours/an respecté" },
];

export function createEmptyMinpakuChecklist(): MinpakuChecklistState {
  return Object.fromEntries(MINPAKU_CHECKLIST_TEMPLATE.map((item) => [item.id, false]));
}

export interface MinpakuChecklistSummary {
  completed: number;
  total: number;
}

export function computeMinpakuChecklistSummary(state: MinpakuChecklistState): MinpakuChecklistSummary {
  const total = MINPAKU_CHECKLIST_TEMPLATE.length;
  const completed = MINPAKU_CHECKLIST_TEMPLATE.filter((item) => state[item.id] === true).length;
  return { completed, total };
}

// Loi sur les hébergements privés (Jūtaku Shukuhaku Jigyō Hō, en vigueur
// depuis 2018) : régime déclaratif (pas une licence), plafonné à 180
// jours par an au niveau national ; certaines municipalités abaissent ce
// plafond localement.
export const MINPAKU_180_DAYS_DISCLAIMER =
  "Le régime déclaratif du minpaku (loi sur les hébergements privés) plafonne l'exploitation à 180 jours par an au niveau national — certaines municipalités abaissent ce plafond localement. Aucune estimation de revenu n'est calculée ici : à valider avec la mairie avant tout projet.";

// Y.5 — Rénover ou démolir : une simple comparaison de deux coûts saisis,
// jamais une conclusion sur la faisabilité de reconstruire (cf. Reality
// Gate V.2, droit à reconstruire).
export interface DemolitionComparison {
  renovationJpy: number;
  demolitionJpy: number;
  deltaJpy: number;
}

export function computeDemolitionComparison(
  renovationJpy: number,
  demolitionJpy: number,
): DemolitionComparison {
  return { renovationJpy, demolitionJpy, deltaJpy: demolitionJpy - renovationJpy };
}
