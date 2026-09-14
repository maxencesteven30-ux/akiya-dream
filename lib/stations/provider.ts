import { latLonToTile } from "@/lib/mlit/tile-math";
import { fetchMlitEndpoint } from "@/lib/mlit/fetch-mlit";
import { distanceToLineStringMeters, type Position } from "@/lib/stations/distance-to-line";
import { parseStationFeature, type StationInfo } from "@/lib/stations/station-data";

// Era 9 (suite) — provider "gares les plus proches" (国土数値情報「駅別
// 乗降客数」XKT015). Volontairement écarté de la Phase amenities (même
// session) car sa géométrie est un LineString (segment ferroviaire),
// pas un Point — vérifié en conditions réelles (tuile z14/x14481/y6396,
// Nagano, le 2026-09-15) : un tracé réel de ~130m associé à une gare
// nommée (善光寺下, ligne 長野線, exploitant 長野電鉄).
//
// Même limite honnête que le moteur de services essentiels : la
// recherche ne porte que sur la tuile contenant le point (~2,4km) —
// NONE_IN_TILE, jamais "aucune gare à proximité".

const STATION_ZOOM = 14;
const STATION_ENDPOINT = "https://www.reinfolib.mlit.go.jp/ex-api/external/XKT015";
const STATION_SOURCE_NAME = "MLIT — 国土数値情報 (駅別乗降客数 XKT015)";
const STATION_SOURCE_URL = "https://www.reinfolib.mlit.go.jp/";

export type StationSearchStatus =
  | "FOUND"
  | "NONE_IN_TILE"
  | "INSUFFICIENT_PRECISION"
  | "DATA_UNAVAILABLE"
  | "ERROR";

export interface NearestStation {
  info: StationInfo;
  distanceMeters: number;
}

export interface StationSearchMetadata {
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
}

export interface StationSearchResult {
  status: StationSearchStatus;
  // Triées par distance croissante.
  stations: NearestStation[];
  metadata: StationSearchMetadata;
}

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

interface StationGeoJsonFeature {
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

interface StationGeoJsonResponse {
  features: StationGeoJsonFeature[];
}

function isStationGeoJsonResponse(value: unknown): value is StationGeoJsonResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "features" in value &&
    Array.isArray((value as { features: unknown }).features)
  );
}

export interface FetchNearestStationsParams {
  latitude: number | null;
  longitude: number | null;
}

export async function fetchNearestStations(
  params: FetchNearestStationsParams,
  fetchImpl: typeof fetch = fetch,
): Promise<StationSearchResult> {
  const fetchedAt = new Date().toISOString();
  const metadata: StationSearchMetadata = {
    sourceName: STATION_SOURCE_NAME,
    sourceUrl: STATION_SOURCE_URL,
    fetchedAt,
  };

  if (params.latitude === null || params.longitude === null) {
    return { status: "INSUFFICIENT_PRECISION", stations: [], metadata };
  }

  if (!isServerEnvironment()) {
    return { status: "ERROR", stations: [], metadata };
  }

  const apiKey = process.env.MLIT_API_KEY;
  if (!apiKey) {
    return { status: "DATA_UNAVAILABLE", stations: [], metadata };
  }

  const tile = latLonToTile(params.latitude, params.longitude, STATION_ZOOM);
  const url = new URL(STATION_ENDPOINT);
  url.searchParams.set("response_format", "geojson");
  url.searchParams.set("z", String(tile.z));
  url.searchParams.set("x", String(tile.x));
  url.searchParams.set("y", String(tile.y));

  const outcome = await fetchMlitEndpoint(url.toString(), apiKey, fetchImpl);
  if (outcome.kind === "network_error" || outcome.kind === "http_error") {
    return { status: "ERROR", stations: [], metadata };
  }
  if (outcome.kind === "auth_failure") {
    return { status: "DATA_UNAVAILABLE", stations: [], metadata };
  }

  const json = outcome.json;
  if (!isStationGeoJsonResponse(json)) {
    return { status: "ERROR", stations: [], metadata };
  }

  const stations: NearestStation[] = [];
  for (const feature of json.features) {
    if (feature.geometry.type !== "LineString") continue;
    const info = parseStationFeature(feature.properties);
    if (!info) continue;
    const line = feature.geometry.coordinates as Position[];
    stations.push({
      info,
      distanceMeters: distanceToLineStringMeters(params.latitude, params.longitude, line),
    });
  }

  stations.sort((a, b) => a.distanceMeters - b.distanceMeters);

  return { status: stations.length > 0 ? "FOUND" : "NONE_IN_TILE", stations, metadata };
}
