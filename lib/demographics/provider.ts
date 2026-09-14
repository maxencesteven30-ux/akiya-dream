import { makeRealityDataResult, insufficientLocationResult, unavailableResult, errorResult } from "@/lib/reality-data";
import type { RealityDataResult } from "@/lib/reality-data";
import { latLonToTile } from "@/lib/mlit/tile-math";
import { fetchMlitEndpoint } from "@/lib/mlit/fetch-mlit";
import { pointInMultiPolygon, pointInPolygon, type PolygonCoordinates } from "@/lib/hazard/point-in-polygon";
import { parsePopulationMeshFeature, type PopulationYearPoint } from "@/lib/demographics/population-mesh";

// Era 9 (suite) — provider démographique réel (国土数値情報「将来推計人口
// メッシュ」, XKT013). Même discipline que les providers MLIT existants
// (serveur uniquement, timeout, 401/403 -> UNAVAILABLE, reste -> ERROR).
//
// Vérifié par appel réel authentifié le 2026-09-14 (tuile z14/x14480/
// y6397, Nagano) : la tuile contient de nombreuses cellules de maille
// 250m — un point donné peut tomber dans plusieurs features à la fois
// tuile (chevauchement de bords), donc la même discipline
// point-in-polygon que le moteur de risques (lib/hazard) est réutilisée
// ici plutôt qu'une nouvelle implémentation parallèle.

const POPULATION_SOURCE_NAME = "MLIT — 国土数値情報 (将来推計人口メッシュ XKT013)";
const POPULATION_SOURCE_URL = "https://www.reinfolib.mlit.go.jp/";
const POPULATION_ENDPOINT = "https://www.reinfolib.mlit.go.jp/ex-api/external/XKT013";
// z14 : dans la plage documentée (11-15), même compromis que pour le
// moteur de risques et XPT002.
const POPULATION_ZOOM = 14;

export interface FetchPopulationProjectionParams {
  latitude: number | null;
  longitude: number | null;
}

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

interface PopulationGeoJsonFeature {
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

interface PopulationGeoJsonResponse {
  features: PopulationGeoJsonFeature[];
}

function isPopulationGeoJsonResponse(value: unknown): value is PopulationGeoJsonResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "features" in value &&
    Array.isArray((value as { features: unknown }).features)
  );
}

export async function fetchPopulationProjection(
  params: FetchPopulationProjectionParams,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityDataResult<PopulationYearPoint[]>> {
  if (!isServerEnvironment()) {
    return errorResult(POPULATION_SOURCE_NAME);
  }

  const apiKey = process.env.MLIT_API_KEY;
  if (!apiKey) {
    return unavailableResult(POPULATION_SOURCE_NAME);
  }

  // Seule une localisation EXACTE justifie de choisir une cellule de
  // maille 250m précise — jamais dérivée d'une municipalité seule.
  if (params.latitude === null || params.longitude === null) {
    return insufficientLocationResult(POPULATION_SOURCE_NAME);
  }

  const tile = latLonToTile(params.latitude, params.longitude, POPULATION_ZOOM);
  const url = new URL(POPULATION_ENDPOINT);
  url.searchParams.set("response_format", "geojson");
  url.searchParams.set("z", String(tile.z));
  url.searchParams.set("x", String(tile.x));
  url.searchParams.set("y", String(tile.y));

  const outcome = await fetchMlitEndpoint(url.toString(), apiKey, fetchImpl);
  if (outcome.kind === "network_error" || outcome.kind === "http_error") {
    return errorResult(POPULATION_SOURCE_NAME);
  }
  if (outcome.kind === "auth_failure") {
    return unavailableResult(POPULATION_SOURCE_NAME);
  }

  const json = outcome.json;
  if (!isPopulationGeoJsonResponse(json)) {
    return errorResult(POPULATION_SOURCE_NAME);
  }

  const containingFeature = json.features.find((feature) => {
    if (feature.geometry.type === "Polygon") {
      return pointInPolygon(params.longitude!, params.latitude!, feature.geometry.coordinates as PolygonCoordinates);
    }
    if (feature.geometry.type === "MultiPolygon") {
      return pointInMultiPolygon(
        params.longitude!,
        params.latitude!,
        feature.geometry.coordinates as PolygonCoordinates[],
      );
    }
    return false;
  });

  const baseMetadata = {
    sourceName: POPULATION_SOURCE_NAME,
    sourceUrl: POPULATION_SOURCE_URL,
    confidence: "HIGH" as const,
    // La cellule de maille (~250m) n'est pas l'adresse exacte du bien —
    // approximatif, jamais présenté comme une donnée à la parcelle.
    geographicPrecision: "APPROXIMATE" as const,
  };

  if (!containingFeature) {
    // La tuile a répondu mais aucune cellule ne couvre ce point (bord de
    // tuile, zone hors maillage) — jamais interprété comme "population
    // nulle" ou "pas de déclin".
    return makeRealityDataResult("NOT_FOUND", baseMetadata, []);
  }

  const points = parsePopulationMeshFeature(containingFeature.properties);
  if (points.length === 0) {
    return makeRealityDataResult("NOT_FOUND", baseMetadata, []);
  }

  return makeRealityDataResult("AVAILABLE", baseMetadata, points);
}
