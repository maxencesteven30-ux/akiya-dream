import { ensureAnonymousSession, getSupabaseClient } from "@/lib/supabase";
import type {
  AcquisitionCost,
  AnnualCost,
  BuyerProfile,
  CostsData,
  DataConfidence,
  NewProjectInput,
  PersistedProject,
  RealListing,
  RecommendationLevel,
  Region,
  RegionAttributes,
  RegionAttributeDetail,
  RenovationCost,
  RenovationLevel,
} from "@/lib/types";

// Taux indicatif, mis à jour manuellement (source : marché des changes,
// cf. Investing.com/XE) — pas un flux temps réel.
export const EUR_JPY_RATE = 179.27;

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

interface RegionAttributeRow {
  attribute_key: string;
  value_numeric: number | null;
  regions: { name: string } | null;
}

const EMPTY_REGION_ATTRIBUTES: RegionAttributes = {
  hasCoastline: null,
  shinkansenStationCount: null,
  forestAreaPercent: null,
  avgAnnualSnowfallCm: null,
};

export async function fetchRegionAttributes(): Promise<Record<string, RegionAttributes>> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("region_attributes")
      .select("attribute_key, value_numeric, regions(name)")
      .returns<RegionAttributeRow[]>();

    if (error) throw error;

    const byRegion: Record<string, RegionAttributes> = {};

    for (const row of data ?? []) {
      const name = row.regions?.name;
      if (!name) continue;
      if (!byRegion[name]) byRegion[name] = { ...EMPTY_REGION_ATTRIBUTES };

      switch (row.attribute_key) {
        case "has_coastline":
          byRegion[name].hasCoastline =
            row.value_numeric === null ? null : row.value_numeric === 1;
          break;
        case "shinkansen_station_count":
          byRegion[name].shinkansenStationCount = row.value_numeric;
          break;
        case "forest_area_percent":
          byRegion[name].forestAreaPercent = row.value_numeric;
          break;
        case "avg_annual_snowfall_cm":
          byRegion[name].avgAnnualSnowfallCm = row.value_numeric;
          break;
      }
    }

    return byRegion;
  } catch (error) {
    console.error("fetchRegionAttributes failed:", error);
    throw new Error("Impossible de charger les attributs régionaux depuis Supabase.");
  }
}

interface RegionAttributeDetailRow {
  attribute_key: string;
  value_numeric: number | null;
  source_name: string;
  source_url: string | null;
  verified_at: string;
  confidence: DataConfidence;
  notes: string | null;
  regions: { name: string } | null;
}

const ATTRIBUTE_DISPLAY: Record<string, { label: string; unit: string }> = {
  has_coastline: { label: "Façade maritime", unit: "" },
  shinkansen_station_count: { label: "Gares Shinkansen", unit: "" },
  forest_area_percent: { label: "Couverture forestière", unit: "%" },
  avg_annual_snowfall_cm: { label: "Neige moyenne / an", unit: "cm" },
};

export async function fetchRegionAttributeDetails(): Promise<
  Record<string, RegionAttributeDetail[]>
> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("region_attributes")
      .select("attribute_key, value_numeric, source_name, source_url, verified_at, confidence, notes, regions(name)")
      .returns<RegionAttributeDetailRow[]>();

    if (error) throw error;

    const byRegion: Record<string, RegionAttributeDetail[]> = {};

    for (const row of data ?? []) {
      const name = row.regions?.name;
      if (!name) continue;
      if (!byRegion[name]) byRegion[name] = [];

      const display = ATTRIBUTE_DISPLAY[row.attribute_key] ?? {
        label: row.attribute_key,
        unit: "",
      };

      byRegion[name].push({
        key: row.attribute_key,
        label: display.label,
        value: row.value_numeric,
        unit: display.unit,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
        verifiedAt: row.verified_at,
        confidence: row.confidence,
        notes: row.notes,
      });
    }

    return byRegion;
  } catch (error) {
    console.error("fetchRegionAttributeDetails failed:", error);
    throw new Error("Impossible de charger le détail des attributs régionaux depuis Supabase.");
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

interface ProjectRow {
  id: number;
  name: string;
  profile: BuyerProfile;
  house_price_jpy: number;
  prefecture: string | null;
  renovation_level: RenovationLevel | null;
  capital_disponible_eur: number | null;
  reserve_securite_eur: number | null;
  real_listing: RealListing | null;
  created_at: string;
  updated_at: string;
  share_token: string | null;
}

function mapProjectRow(row: ProjectRow): PersistedProject {
  return {
    id: row.id,
    name: row.name,
    profile: row.profile,
    housePriceJpy: row.house_price_jpy,
    prefecture: row.prefecture,
    renovationLevel: row.renovation_level,
    capitalDisponibleEur: row.capital_disponible_eur,
    reserveSecuriteEur: row.reserve_securite_eur,
    realListing: row.real_listing,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shareToken: row.share_token,
  };
}

// Ces trois fonctions supposent qu'une session (anonyme ou non) existe.
// Si "Allow anonymous sign-ins" n'est pas activé côté Supabase,
// ensureAnonymousSession() retourne null : on lève une erreur explicite
// plutôt que d'échouer silencieusement, car sauvegarder est une action
// volontaire de l'utilisateur (contrairement au chargement des régions).
export async function requireUserId(): Promise<string> {
  const userId = await ensureAnonymousSession();
  if (!userId) {
    throw new Error(
      "Connexion anonyme indisponible. Vérifiez que \"Allow anonymous sign-ins\" est activé dans le dashboard Supabase (Authentication > Providers).",
    );
  }
  return userId;
}

export async function fetchMyProjects(): Promise<PersistedProject[]> {
  try {
    const userId = await ensureAnonymousSession();
    if (!userId) return [];

    const { data, error } = await getSupabaseClient()
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<ProjectRow[]>();

    if (error) throw error;
    return (data ?? []).map(mapProjectRow);
  } catch (error) {
    console.error("fetchMyProjects failed:", error);
    throw new Error("Impossible de charger vos projets sauvegardés depuis Supabase.");
  }
}

export async function saveProject(input: NewProjectInput): Promise<PersistedProject> {
  try {
    const userId = await requireUserId();

    const { data, error } = await getSupabaseClient()
      .from("projects")
      .insert({
        user_id: userId,
        name: input.name,
        profile: input.profile,
        house_price_jpy: input.housePriceJpy,
        prefecture: input.prefecture,
        renovation_level: input.renovationLevel,
        capital_disponible_eur: input.capitalDisponibleEur,
        reserve_securite_eur: input.reserveSecuriteEur,
        real_listing: input.realListing,
      })
      .select()
      .returns<ProjectRow[]>()
      .single();

    if (error) throw error;
    return mapProjectRow(data);
  } catch (error) {
    console.error("saveProject failed:", error);
    throw error instanceof Error
      ? error
      : new Error("Impossible d'enregistrer ce projet dans Supabase.");
  }
}

export async function deleteProject(id: number): Promise<void> {
  try {
    const { error } = await getSupabaseClient().from("projects").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("deleteProject failed:", error);
    throw new Error("Impossible de supprimer ce projet dans Supabase.");
  }
}

// Partage par lien (pas par email : l'app utilise l'auth anonyme, sans
// email associé, et aucun service d'envoi transactionnel n'existe dans ce
// projet — cf. migration 005_project_sharing.sql). Le jeton est généré côté
// client puis stocké via une simple mise à jour (déjà couverte par la
// policy RLS "propriétaire uniquement" existante) ; la lecture d'un projet
// partagé passe exclusivement par la fonction Postgres get_shared_project,
// qui exige une correspondance exacte du jeton.
export async function shareProject(id: number): Promise<string> {
  try {
    const token =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

    const { error } = await getSupabaseClient()
      .from("projects")
      .update({ share_token: token })
      .eq("id", id);

    if (error) throw error;
    return token;
  } catch (error) {
    console.error("shareProject failed:", error);
    throw new Error("Impossible de générer le lien de partage.");
  }
}

export async function unshareProject(id: number): Promise<void> {
  try {
    const { error } = await getSupabaseClient()
      .from("projects")
      .update({ share_token: null })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("unshareProject failed:", error);
    throw new Error("Impossible d'arrêter le partage de ce projet.");
  }
}

export async function getSharedProject(token: string): Promise<PersistedProject | null> {
  try {
    const { data, error } = await getSupabaseClient().rpc("get_shared_project", { token });

    if (error) throw error;
    const rows = (data ?? []) as ProjectRow[];
    if (rows.length === 0) return null;
    return mapProjectRow(rows[0]);
  } catch (error) {
    console.error("getSharedProject failed:", error);
    throw new Error("Impossible de charger ce projet partagé.");
  }
}
