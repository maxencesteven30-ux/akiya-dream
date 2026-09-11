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

export interface SimulatorState {
  profile: BuyerProfile | null;
  housePriceJpy: number;
  prefecture: string | null;
  renovationLevel: RenovationLevel | null;
  capitalDisponibleEur: number | null;
  reserveSecuriteEur: number | null;
  realListing: RealListing | null;
}

export type BudgetVerdictLevel = "viable" | "tendu" | "non_viable";

export interface SavedProject {
  id: string;
  name: string;
  profile: BuyerProfile;
  housePriceJpy: number;
  renovationLevel: RenovationLevel;
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
}
