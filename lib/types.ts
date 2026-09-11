export type RecommendationLevel = "A" | "B" | "C";

export type BuildingEraCode = "PRE_1981" | "POST_1981" | "POST_2000";

export interface BuildingEra {
  code: BuildingEraCode;
  yearRangeLabel: string;
  seismicStandard: string;
  insulationStandard: string;
  asbestosStatus: string;
  plumbingElectrical: string;
  avgPricePerSqmJpy: number;
  insulationCostPerSqmJpy: number;
  hvacCostPerSqmJpy: number;
  estimatedStructuralSurchargeJpy: number;
  notes: string;
}

export interface Region {
  prefecture: string;
  medianPriceJpy: number;
  medianAgeYears: number;
  pre1981Percent: number;
  subsidyMaxJpy: number;
  recommendationLevel: RecommendationLevel;
}

export interface AcquisitionCost {
  item: string;
  costType: string;
  minJpy: number;
  maxJpy: number;
  percentage: number;
}

export interface RenovationCost {
  category: "Global" | "Specifique";
  item: string;
  minJpy: number;
  maxJpy: number;
}

export interface AnnualCost {
  item: string;
  minJpy: number;
  maxJpy: number;
  percentage: number;
}

export interface CostsData {
  acquisition: AcquisitionCost[];
  renovation: RenovationCost[];
  annual: AnnualCost[];
}

export type BuyerProfile = "solo" | "duo" | "investisseur";

export type RenovationLevel = "leger" | "standard" | "lourd";

export type ListingCondition =
  | "good"
  | "fair"
  | "needs_renovation"
  | "major_renovation"
  | "unknown";

export interface RealListing {
  name: string;
  city: string;
  surfaceM2: number | null;
  landM2: number | null;
  constructionYear: number | null;
  stationDistanceKm: number | null;
  condition: ListingCondition;
}

export type AccompanimentLevel = "autonome" | "curation" | "cle_en_main";

export interface HiddenCostsSelection {
  surveyBoundary: boolean;
  pestTreatment: boolean;
  septicTankService: boolean;
  backTaxesNegotiation: boolean;
}

export type ChecklistStatus = "a_verifier" | "verifie" | "probleme" | "non_applicable";
export type ChecklistCategory = "batiment" | "juridique" | "terrain" | "vie_locale";

// Statut par élément de la checklist, indexé par identifiant d'élément
// (cf. lib/due-diligence.ts pour la liste de référence). Un élément absent
// de cet objet est considéré "à vérifier" (jamais un statut positif par
// défaut).
export type DueDiligenceState = Record<string, ChecklistStatus>;

export type VisitStage = "avant" | "pendant" | "apres";

// Un élément coché ("true") de la checklist de préparation/déroulement de
// visite (cf. lib/visit-checklist.ts, Phase Q). Propre à un bien précis,
// comme dueDiligence. Contrairement à DueDiligenceState (4 statuts), un
// élément absent ou "false" signifie simplement "pas encore fait" : pas de
// nuance nécessaire pour une checklist d'actions.
export type VisitChecklistState = Record<string, boolean>;

// Un point d'étape enregistré manuellement par l'utilisateur (cf.
// lib/history.ts, Phase P). Propre à un bien précis, comme dueDiligence :
// réinitialisé quand un autre projet est chargé.
export interface HistoryEntry {
  id: string;
  timestamp: string;
  housePriceJpy: number;
  travauxJpy: number;
  totalProjetJpy: number;
  eurJpyRate: number;
  // null si la note d'opportunité n'a pas encore été calculée au moment
  // du point d'étape (pas de bien réel renseigné, ou analyse non lancée).
  opportunityScore: number | null;
  // true si ce point d'étape a été enregistré après une visite du bien
  // (constats terrain pris en compte dans les hypothèses) — cf. Phase R,
  // comparaison avant/après visite dans lib/history.ts.
  isPostVisit: boolean;
}

export interface SimulatorState {
  profile: BuyerProfile | null;
  housePriceJpy: number;
  prefecture: string | null;
  renovationLevel: RenovationLevel | null;
  capitalDisponibleEur: number | null;
  reserveSecuriteEur: number | null;
  realListing: RealListing | null;
  accompanimentLevel: AccompanimentLevel;
  needsTranslation: boolean;
  hiddenCosts: HiddenCostsSelection;
  snowyRegion: boolean;
  includeNeighborhoodAssociation: boolean;
  dueDiligence: DueDiligenceState;
  history: HistoryEntry[];
  // Id Supabase du dernier projet sauvegardé ou chargé dans cette session,
  // null tant qu'aucune sauvegarde n'a eu lieu. Les pièces jointes (Phase O)
  // ne peuvent être attachées qu'à un projet possédant un id.
  currentProjectId: number | null;
  visitChecklist: VisitChecklistState;
}

export type BudgetVerdictLevel = "viable" | "tendu" | "non_viable";

export interface SavedProject {
  id: string;
  name: string;
  profile: BuyerProfile;
  housePriceJpy: number;
  renovationLevel: RenovationLevel;
  // Optionnels : connus seulement si renseignés au moment de l'ajout au
  // comparateur (jamais déduits ou inventés après coup).
  prefecture: string | null;
  realListing: RealListing | null;
}

export interface RegionAttributes {
  hasCoastline: boolean | null;
  shinkansenStationCount: number | null;
  forestAreaPercent: number | null;
  avgAnnualSnowfallCm: number | null;
}

export type DataConfidence = "verified" | "estimated" | "unknown";

export interface RegionAttributeDetail {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  sourceName: string;
  sourceUrl: string | null;
  verifiedAt: string;
  confidence: DataConfidence;
  notes: string | null;
}

export type SubsidyType = "renovation" | "relocation";
export type SubsidyLevel = "national" | "prefectural" | "municipal";

export interface SubsidyEligibility {
  // null = non précisé de façon fiable par la source pour ce programme
  // précis (jamais une supposition) ; requiresAkiyaBank est le seul champ
  // toujours connu car explicitement signalé par la source pour chaque
  // programme.
  minResidenceYears: number | null;
  requiresLocalContractor: boolean | null;
  requiresAkiyaBank: boolean;
  ageLimit: number | null;
}

export interface Subsidy {
  id: string;
  name: string;
  prefecture: string;
  municipality: string;
  level: SubsidyLevel;
  type: SubsidyType;
  maxAmountJpy: number;
  coveragePercent: number | null;
  conditions: string[];
  eligibility: SubsidyEligibility;
  applicationDeadline: string;
  sourceName: string;
  sourceUrl: string | null;
  verifiedAt: string;
  confidence: DataConfidence;
}

export interface NewProjectInput {
  name: string;
  profile: BuyerProfile;
  housePriceJpy: number;
  prefecture: string | null;
  renovationLevel: RenovationLevel | null;
  capitalDisponibleEur: number | null;
  reserveSecuriteEur: number | null;
  realListing: RealListing | null;
}

export interface PersistedProject extends NewProjectInput {
  id: number;
  createdAt: string;
  updatedAt: string;
  shareToken: string | null;
}
