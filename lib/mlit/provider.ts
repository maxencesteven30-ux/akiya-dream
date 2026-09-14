import { makeRealityDataResult, unavailableResult, insufficientLocationResult, errorResult } from "@/lib/reality-data";
import type { RealityDataResult } from "@/lib/reality-data";
import { parseMlitTransaction, type MlitApiResponse, type MlitTransaction } from "@/lib/mlit/types";
import { fetchMlitEndpoint } from "@/lib/mlit/fetch-mlit";

// Phase AC — MLIT provider (不動産情報ライブラリ, transactions XIT001).
//
// SERVEUR UNIQUEMENT : l'API MLIT interdit explicitement les requêtes
// navigateur ("APIリクエストをブラウザから送信しないようご注意ください",
// vérifié dans la documentation officielle, Phase AA). La clé vit dans
// `MLIT_API_KEY` (jamais `NEXT_PUBLIC_*`) et n'est lue que côté serveur —
// ce module ne doit être importé que par un Route Handler.

const MLIT_SOURCE_NAME = "MLIT — 不動産情報ライブラリ (transactions XIT001)";
const MLIT_SOURCE_URL = "https://www.reinfolib.mlit.go.jp/";
const MLIT_ENDPOINT = "https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001";

export interface FetchComparableTransactionsParams {
  // Code municipal à 5 chiffres (総務省) — null si non disponible :
  // Akiya Dream n'a aujourd'hui qu'une ville en texte libre, pas de code
  // officiel dérivé automatiquement (limite documentée dans l'audit).
  municipalityCode: string | null;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  priceClassification?: "01" | "02";
}

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

function isMlitApiResponse(value: unknown): value is MlitApiResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray((value as { data: unknown }).data)
  );
}

export async function fetchComparableTransactions(
  params: FetchComparableTransactionsParams,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityDataResult<MlitTransaction[]>> {
  if (!isServerEnvironment()) {
    // Filet de sécurité supplémentaire : ce provider ne doit jamais
    // s'exécuter côté navigateur, même par erreur d'import.
    return errorResult(MLIT_SOURCE_NAME);
  }

  const apiKey = process.env.MLIT_API_KEY;
  if (!apiKey) {
    return unavailableResult(MLIT_SOURCE_NAME);
  }

  if (!params.municipalityCode) {
    return insufficientLocationResult(MLIT_SOURCE_NAME);
  }

  const url = new URL(MLIT_ENDPOINT);
  url.searchParams.set("year", String(params.year));
  url.searchParams.set("quarter", String(params.quarter));
  url.searchParams.set("city", params.municipalityCode);
  if (params.priceClassification) {
    url.searchParams.set("priceClassification", params.priceClassification);
  }

  const outcome = await fetchMlitEndpoint(url.toString(), apiKey, fetchImpl);
  if (outcome.kind === "network_error" || outcome.kind === "http_error") {
    // Regroupe timeout (AbortError), échec réseau et toute autre panne
    // technique — ERROR, jamais UNAVAILABLE (qui signifierait une source
    // mal configurée, pas un problème réseau ponctuel).
    return errorResult(MLIT_SOURCE_NAME);
  }
  if (outcome.kind === "auth_failure") {
    return unavailableResult(MLIT_SOURCE_NAME);
  }

  const json = outcome.json;
  if (!isMlitApiResponse(json)) {
    return errorResult(MLIT_SOURCE_NAME);
  }

  const transactions = json.data
    .map(parseMlitTransaction)
    .filter((t): t is MlitTransaction => t !== null);

  const baseMetadata = {
    sourceName: MLIT_SOURCE_NAME,
    sourceUrl: MLIT_SOURCE_URL,
    sourceDate: `${params.year}Q${params.quarter}`,
    confidence: "HIGH" as const,
    geographicPrecision: "MUNICIPALITY" as const,
  };

  if (transactions.length === 0) {
    // La source a répondu, mais rien pour cette requête précise — jamais
    // interprété comme "aucun risque" ou "prix confirmé".
    return makeRealityDataResult("NOT_FOUND", baseMetadata, []);
  }

  return makeRealityDataResult("AVAILABLE", baseMetadata, transactions);
}
