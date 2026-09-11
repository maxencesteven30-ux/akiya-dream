import type {
  CaretakerType,
  CheckFrequency,
  NonResidentAdminState,
  OwnershipGoal,
  OwnershipPurpose,
  RemoteOwnerProfile,
  ResidenceLocation,
  UsageFrequency,
  VacancyDuration,
} from "@/lib/types";

// Phase X — Remote Owner : "que va me coûter cette maison si je ne vis pas
// au Japon ?". Toutes les checklists sont déclaratives — jamais de calcul
// automatique de coût, jamais de statut positif par défaut.
//
// Repères réglementaires généraux cités dans les libellés (jamais vérifiés
// automatiquement, toujours à confirmer avec un professionnel) :
// - Un propriétaire non-résident percevant des revenus locatifs au Japon
//   doit désigner un représentant fiscal (nōzei kanrinin) via une
//   notification à l'administration fiscale locale.
// - Certaines municipalités introduisent des taxes locales spécifiques
//   sur les logements vacants ou les résidences secondaires (ex. Kyoto,
//   taxe prévue à partir de l'exercice fiscal 2030) — un dispositif
//   local, pas une règle nationale généralisable.

export function createEmptyRemoteOwnerProfile(): RemoteOwnerProfile {
  return {
    residenceLocation: null,
    usageFrequency: null,
    vacancyDuration: null,
    caretaker: null,
    checkFrequency: null,
    ownershipPurpose: null,
    ownershipGoal: null,
    visaPlanConfirmed: false,
    nonResidentAdmin: {},
  };
}

export const RESIDENCE_LOCATION_LABELS: Record<ResidenceLocation, string> = {
  hors_japon: "🇫🇷 Je réside hors du Japon",
  au_japon: "🇯🇵 Je réside au Japon",
};

export const USAGE_FREQUENCY_LABELS: Record<UsageFrequency, string> = {
  toute_annee: "Toute l'année",
  plusieurs_mois: "Plusieurs mois",
  quelques_semaines: "Quelques semaines",
  occasionnel: "Occasionnellement",
  pas_avant_plusieurs_annees: "Pas avant plusieurs années",
};

export const VACANCY_DURATION_LABELS: Record<VacancyDuration, string> = {
  jamais: "Jamais (occupée toute l'année)",
  quelques_semaines: "Quelques semaines par an",
  quelques_mois: "Quelques mois par an",
  la_plupart_de_lannee: "La plupart de l'année",
  en_permanence: "En permanence",
};

export const CARETAKER_LABELS: Record<CaretakerType, string> = {
  moi: "Moi-même",
  ami: "Un ami",
  voisin: "Un voisin",
  agence: "Une agence",
  societe_locale: "Une société locale",
  personne: "Personne actuellement",
};

export const CHECK_FREQUENCY_LABELS: Record<CheckFrequency, string> = {
  hebdomadaire: "Hebdomadaire",
  mensuelle: "Mensuelle",
  saisonniere: "Saisonnière",
  annuelle: "Annuelle",
};

export const OWNERSHIP_PURPOSE_LABELS: Record<OwnershipPurpose, string> = {
  residence_principale: "Résidence principale",
  residence_secondaire: "Résidence secondaire",
  investissement: "Investissement",
  vacante_travaux: "Maison vacante en attente de travaux",
};

export const OWNERSHIP_GOAL_LABELS: Record<OwnershipGoal, string> = {
  pied_a_terre: "Pied-à-terre",
  future_residence: "Future résidence",
  residence_actuelle: "Résidence actuelle",
  investissement: "Investissement",
};

// X.4 — checklist administrative du propriétaire non-résident.
export interface NonResidentAdminItemDef {
  id: string;
  label: string;
}

export const NON_RESIDENT_ADMIN_TEMPLATE: NonResidentAdminItemDef[] = [
  { id: "representant_fiscal", label: "Représentant fiscal (nōzei kanrinin) désigné" },
  { id: "correspondance_administrative", label: "Adresse de correspondance administrative organisée" },
  { id: "fiscalite_locale", label: "Fiscalité locale (taxes foncières, revenus locatifs) comprise" },
  { id: "paiements", label: "Moyen de paiement des taxes/charges depuis l'étranger organisé" },
  { id: "assurance", label: "Assurance habitation en place" },
  { id: "gestion", label: "Gestion courante (courrier, urgences) organisée" },
  { id: "maintenance", label: "Maintenance régulière planifiée" },
];

export function createEmptyNonResidentAdmin(): NonResidentAdminState {
  return Object.fromEntries(NON_RESIDENT_ADMIN_TEMPLATE.map((item) => [item.id, false]));
}

export interface NonResidentAdminSummary {
  completed: number;
  total: number;
}

export function computeNonResidentAdminSummary(state: NonResidentAdminState): NonResidentAdminSummary {
  const total = NON_RESIDENT_ADMIN_TEMPLATE.length;
  const completed = NON_RESIDENT_ADMIN_TEMPLATE.filter((item) => state[item.id] === true).length;
  return { completed, total };
}

// X.2 — Risque de vacance ("pas un chiffre arbitraire") : un statut
// qualitatif avec ses raisons, jamais un score numérique inventé.
export type VacancyRiskLevel = "vert" | "orange" | "rouge";

export interface VacancyRiskResult {
  level: VacancyRiskLevel;
  label: string;
  reasons: string[];
}

const VACANCY_RISK_LABELS: Record<VacancyRiskLevel, string> = {
  vert: "🟢 Gestion organisée",
  orange: "🟠 Gestion à distance à renforcer",
  rouge: "🔴 Maison longue période sans surveillance",
};

export function computeVacancyRisk(input: {
  vacancyDuration: VacancyDuration | null;
  caretaker: CaretakerType | null;
  checkFrequency: CheckFrequency | null;
}): VacancyRiskResult {
  const { vacancyDuration, caretaker, checkFrequency } = input;

  if (vacancyDuration === null || caretaker === null || checkFrequency === null) {
    return {
      level: "orange",
      label: VACANCY_RISK_LABELS.orange,
      reasons: ["Plan de gestion pendant l'absence non encore renseigné."],
    };
  }

  if (caretaker === "personne") {
    return {
      level: "rouge",
      label: VACANCY_RISK_LABELS.rouge,
      reasons: ["Personne n'est actuellement chargé de vérifier la maison."],
    };
  }

  const longVacancy = vacancyDuration === "la_plupart_de_lannee" || vacancyDuration === "en_permanence";

  if (checkFrequency === "annuelle") {
    if (longVacancy) {
      return {
        level: "rouge",
        label: VACANCY_RISK_LABELS.rouge,
        reasons: [
          "Vérifications seulement annuelles.",
          "La maison reste vide une grande partie de l'année.",
        ],
      };
    }
    return {
      level: "orange",
      label: VACANCY_RISK_LABELS.orange,
      reasons: ["Vérifications seulement annuelles."],
    };
  }

  if (checkFrequency === "saisonniere" && longVacancy) {
    return {
      level: "orange",
      label: VACANCY_RISK_LABELS.orange,
      reasons: ["La maison reste vide une grande partie de l'année malgré des vérifications saisonnières."],
    };
  }

  return { level: "vert", label: VACANCY_RISK_LABELS.vert, reasons: [] };
}

// X.5 — le piège "j'achète pour pouvoir vivre au Japon" : un garde-fou
// permanent, jamais désactivé automatiquement.
export function shouldShowVisaWarning(goal: OwnershipGoal | null, visaPlanConfirmed: boolean): boolean {
  return goal === "future_residence" && !visaPlanConfirmed;
}

export const VISA_DISCLAIMER =
  "Posséder un bien immobilier ne remplace pas un statut de séjour. L'achat immobilier et le droit de résider au Japon sont deux sujets distincts.";

export const NON_RESIDENT_TAX_DISCLAIMER =
  "Un propriétaire non-résident percevant des revenus locatifs au Japon doit en général désigner un représentant fiscal (nōzei kanrinin) auprès de l'administration fiscale locale. Les obligations exactes dépendent de la situation : à confirmer avec un fiscaliste (zeirishi).";

export const VACANT_HOME_TAX_DISCLAIMER =
  "Certaines municipalités peuvent avoir des dispositifs locaux spécifiques sur les logements vacants ou les résidences secondaires (par exemple Kyoto, avec une taxe prévue à partir de l'exercice fiscal 2030). Ce n'est pas une règle nationale — à vérifier auprès de la commune concernée.";
