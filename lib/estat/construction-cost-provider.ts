import {
  isConstructionCostApiResponse,
  latestConstructionCostPerSqm,
  parseConstructionCostSeries,
} from "@/lib/estat/construction-cost";

// Provider e-Stat pour le coût de construction régional (建築着工統計調査,
// table 0003117509) — même discipline que lib/estat/provider.ts : appId
// serveur uniquement, timeout, RESULT.STATUS non nul -> DATA_UNAVAILABLE
// (l'API e-Stat ne signale jamais une erreur par un code HTTP).
//
// Complète, sans le remplacer, le forfait national de rénovation
// (RENOVATION_COST_PER_SQM_JPY, lib/calculations.ts) : ce chiffre est
// une référence RÉGIONALE de coût de CONSTRUCTION NEUVE (bois), jamais
// utilisé pour calculer un budget travaux — seulement affiché comme
// contexte informatif dans l'onglet Ville.

const ESTAT_SOURCE_NAME = "e-Stat — 建築着工統計調査 (bâtiments en bois, par préfecture)";
const ESTAT_SOURCE_URL = "https://www.e-stat.go.jp/dbview?sid=0003117509";
const ESTAT_ENDPOINT = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData";
const CONSTRUCTION_COST_STATS_DATA_ID = "0003117509";
const WOODEN_CAT01_CODE = "12";
const REQUEST_TIMEOUT_MS = 10_000;

export type ConstructionCostStatus =
  | "AVAILABLE"
  | "NOT_FOUND"
  | "DATA_UNAVAILABLE"
  | "INSUFFICIENT_DATA"
  | "ERROR";

export interface ConstructionCostData {
  prefectureCode: string;
  fiscalYear: number;
  costPerSqmJpy: number;
}

export interface ConstructionCostResult {
  status: ConstructionCostStatus;
  data?: ConstructionCostData;
  metadata: {
    sourceName: string;
    sourceUrl?: string;
    sourceDate?: string;
    fetchedAt: string;
    confidence?: "HIGH";
  };
}

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

export async function fetchPrefectureConstructionCostPerSqm(
  prefectureCode: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ConstructionCostResult> {
  const fetchedAt = new Date().toISOString();
  const baseMetadata = { sourceName: ESTAT_SOURCE_NAME, sourceUrl: ESTAT_SOURCE_URL, fetchedAt };

  if (!isServerEnvironment()) {
    return { status: "ERROR", metadata: baseMetadata };
  }
  if (!prefectureCode) {
    return { status: "INSUFFICIENT_DATA", metadata: baseMetadata };
  }

  const appId = process.env.ESTAT_APP_ID;
  if (!appId) {
    return { status: "DATA_UNAVAILABLE", metadata: baseMetadata };
  }

  const url = new URL(ESTAT_ENDPOINT);
  url.searchParams.set("appId", appId);
  url.searchParams.set("statsDataId", CONSTRUCTION_COST_STATS_DATA_ID);
  // Code préfecture e-Stat = code JIS 2 chiffres + "000" (ex. "46000"
  // pour 鹿児島県) — vérifié par appel réel, cf. lib/estat/construction-cost.ts.
  url.searchParams.set("cdArea", `${prefectureCode}000`);
  url.searchParams.set("cdCat01", WOODEN_CAT01_CODE);
  url.searchParams.set("cdTab", "13,14");

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  let json: unknown;
  try {
    const response = await fetchImpl(url.toString(), { signal: timeoutController.signal });
    if (!response.ok) return { status: "ERROR", metadata: baseMetadata };
    json = await response.json();
  } catch {
    return { status: "ERROR", metadata: baseMetadata };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!isConstructionCostApiResponse(json)) {
    return { status: "ERROR", metadata: baseMetadata };
  }

  const resultStatus = json.GET_STATS_DATA?.RESULT?.STATUS;
  if (resultStatus !== 0) {
    return { status: "DATA_UNAVAILABLE", metadata: baseMetadata };
  }

  const series = parseConstructionCostSeries(json);
  const latest = latestConstructionCostPerSqm(series);
  const confirmedMetadata = { ...baseMetadata, confidence: "HIGH" as const };

  if (!latest) {
    return { status: "NOT_FOUND", metadata: confirmedMetadata };
  }

  return {
    status: "AVAILABLE",
    data: { prefectureCode, fiscalYear: latest.fiscalYear, costPerSqmJpy: latest.costPerSqmJpy },
    metadata: { ...confirmedMetadata, sourceDate: String(latest.fiscalYear) },
  };
}
