export type RecommendationLevel = "A" | "B" | "C";

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

export interface RealListing {
  name: string;
  city: string;
  surfaceM2: number | null;
  landM2: number | null;
  constructionYear: number | null;
  stationDistanceKm: number | null;
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
