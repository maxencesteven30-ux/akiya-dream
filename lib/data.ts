import { getSupabaseClient } from "@/lib/supabase";
import type {
  AcquisitionCost,
  AnnualCost,
  CostsData,
  RecommendationLevel,
  Region,
  RenovationCost,
} from "@/lib/types";

export const EUR_JPY_RATE = 179.09;

export function jpyToEur(amountJpy: number): number {
  return amountJpy / EUR_JPY_RATE;
}

interface RegionRow {
  id: number;
  name: string;
  median_price: number;
  median_age: number;
  pre_1981_percent: number;
  subsidy_max: number;
  risk_level: RecommendationLevel;
}

interface CostsAcquisitionRow {
  id: number;
  item_name: string;
  cost_type: string;
  min_jpy: number;
  max_jpy: number;
  percentage: number;
}

interface CostsRenovationRow {
  id: number;
  category: "Global" | "Specifique";
  item_name: string;
  min_jpy: number;
  max_jpy: number;
}

interface CostsAnnualRow {
  id: number;
  item_name: string;
  min_jpy: number;
  max_jpy: number;
  percentage: number;
}

function mapRegionRow(row: RegionRow): Region {
  return {
    prefecture: row.name,
    medianPriceJpy: row.median_price,
    medianAgeYears: row.median_age,
    pre1981Percent: row.pre_1981_percent,
    subsidyMaxJpy: row.subsidy_max,
    recommendationLevel: row.risk_level,
  };
}

function mapAcquisitionRow(row: CostsAcquisitionRow): AcquisitionCost {
  return {
    item: row.item_name,
    costType: row.cost_type,
    minJpy: row.min_jpy,
    maxJpy: row.max_jpy,
    percentage: row.percentage,
  };
}

function mapRenovationRow(row: CostsRenovationRow): RenovationCost {
  return {
    category: row.category,
    item: row.item_name,
    minJpy: row.min_jpy,
    maxJpy: row.max_jpy,
  };
}

function mapAnnualRow(row: CostsAnnualRow): AnnualCost {
  return {
    item: row.item_name,
    minJpy: row.min_jpy,
    maxJpy: row.max_jpy,
    percentage: row.percentage,
  };
}

export async function fetchRegions(): Promise<Region[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("regions")
      .select("*")
      .order("name", { ascending: true })
      .returns<RegionRow[]>();

    if (error) throw error;
    return (data ?? []).map(mapRegionRow);
  } catch (error) {
    console.error("fetchRegions failed:", error);
    throw new Error("Impossible de charger les régions depuis Supabase.");
  }
}

export async function fetchAcquisitionCosts(): Promise<AcquisitionCost[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("costs_acquisition")
      .select("*")
      .order("id", { ascending: true })
      .returns<CostsAcquisitionRow[]>();

    if (error) throw error;
    return (data ?? []).map(mapAcquisitionRow);
  } catch (error) {
    console.error("fetchAcquisitionCosts failed:", error);
    throw new Error("Impossible de charger les frais d'acquisition depuis Supabase.");
  }
}

export async function fetchRenovationCosts(): Promise<RenovationCost[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("costs_renovation")
      .select("*")
      .order("id", { ascending: true })
      .returns<CostsRenovationRow[]>();

    if (error) throw error;
    return (data ?? []).map(mapRenovationRow);
  } catch (error) {
    console.error("fetchRenovationCosts failed:", error);
    throw new Error("Impossible de charger les coûts de travaux depuis Supabase.");
  }
}

export async function fetchAnnualCosts(): Promise<AnnualCost[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("costs_annual")
      .select("*")
      .order("id", { ascending: true })
      .returns<CostsAnnualRow[]>();

    if (error) throw error;
    return (data ?? []).map(mapAnnualRow);
  } catch (error) {
    console.error("fetchAnnualCosts failed:", error);
    throw new Error("Impossible de charger les frais annuels depuis Supabase.");
  }
}

export async function fetchCosts(): Promise<CostsData> {
  const [acquisition, renovation, annual] = await Promise.all([
    fetchAcquisitionCosts(),
    fetchRenovationCosts(),
    fetchAnnualCosts(),
  ]);

  return { acquisition, renovation, annual };
}

export async function fetchSimulatorData(): Promise<{
  regions: Region[];
  costs: CostsData;
}> {
  const [regions, costs] = await Promise.all([fetchRegions(), fetchCosts()]);
  return { regions, costs };
}
