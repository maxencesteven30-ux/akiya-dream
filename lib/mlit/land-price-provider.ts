import { makeRealityDataResult, insufficientLocationResult, unavailableResult, errorResult } from "@/lib/reality-data";
import type { RealityDataResult } from "@/lib/reality-data";
import { latLonToTile, DEFAULT_LAND_PRICE_ZOOM } from "@/lib/mlit/tile-math";
import { fetchMlitEndpoint } from "@/lib/mlit/fetch-mlit";
import { parseLandPriceFeature, type LandPriceGeoJsonResponse, type OfficialLandPricePoint } from "@/lib/mlit/land-price-types";

// AD.2 — provider 地価公示・地価調査 (XPT002). Même discipline que le
// provider transactions (Phase AC/AD.1) : serveur uniquement, clé jamais
// exposée, timeout, 401/403 -> UNAVAILABLE, reste -> ERROR.
//
// Différence structurelle importante : XPT002 est interrogé par tuile
// géographique (z/x/y), pas par code municipal — une localisation
// EXACTE (coordonnées GPS) est donc requise, jamais une approximation à
// partir de la seule municipalité (cf. lib/geo-precision.ts).

const LAND_PRICE_SOURCE_NAME = "MLIT — 不動産情報ライブラリ (地価公示・地価調査 XPT002)";
const LAND_PRICE_SOURCE_URL = "https://www.reinfolib.mlit.go.jp/";
const LAND_PRICE_ENDPOINT = "https://www.reinfolib.mlit.go.jp/ex-api/external/XPT002";

export interface FetchOfficialLandPriceParams {
  latitude: number | null;
  longitude: number | null;
  year: number;
}

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

function isLandPriceResponse(value: unknown): value is LandPriceGeoJsonResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "features" in value &&
    Array.isArray((value as { features: unknown }).features)
  );
}

export async function fetchOfficialLandPrice(
  params: FetchOfficialLandPriceParams,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityDataResult<OfficialLandPricePoint[]>> {
  if (!isServerEnvironment()) {
    return errorResult(LAND_PRICE_SOURCE_NAME);
  }

  const apiKey = process.env.MLIT_API_KEY;
  if (!apiKey) {
    return unavailableResult(LAND_PRICE_SOURCE_NAME);
  }

  // Seule une localisation EXACTE (coordonnées) justifie une requête par
  // tuile géographique — jamais dérivée d'une municipalité seule.
  if (params.latitude === null || params.longitude === null) {
    return insufficientLocationResult(LAND_PRICE_SOURCE_NAME);
  }

  const tile = latLonToTile(params.latitude, params.longitude, DEFAULT_LAND_PRICE_ZOOM);
  const url = new URL(LAND_PRICE_ENDPOINT);
  url.searchParams.set("response_format", "geojson");
  url.searchParams.set("z", String(tile.z));
  url.searchParams.set("x", String(tile.x));
  url.searchParams.set("y", String(tile.y));
  url.searchParams.set("year", String(params.year));

  const outcome = await fetchMlitEndpoint(url.toString(), apiKey, fetchImpl);
  if (outcome.kind === "network_error" || outcome.kind === "http_error") {
    return errorResult(LAND_PRICE_SOURCE_NAME);
  }
  if (outcome.kind === "auth_failure") {
    return unavailableResult(LAND_PRICE_SOURCE_NAME);
  }

  const json = outcome.json;
  if (!isLandPriceResponse(json)) {
    return errorResult(LAND_PRICE_SOURCE_NAME);
  }

  const points = json.features
    .map(parseLandPriceFeature)
    .filter((p): p is OfficialLandPricePoint => p !== null);

  const baseMetadata = {
    sourceName: LAND_PRICE_SOURCE_NAME,
    sourceUrl: LAND_PRICE_SOURCE_URL,
    sourceDate: String(params.year),
    confidence: "HIGH" as const,
    // Un point dans la tuile z14 (~2,4 km) n'est pas la parcelle exacte
    // du bien — approximatif, jamais présenté comme précis à la parcelle.
    geographicPrecision: "APPROXIMATE" as const,
  };

  if (points.length === 0) {
    return makeRealityDataResult("NOT_FOUND", baseMetadata, []);
  }

  return makeRealityDataResult("AVAILABLE", baseMetadata, points);
}
