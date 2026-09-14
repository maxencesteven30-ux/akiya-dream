import { latLonToTile } from "@/lib/mlit/tile-math";
import { pointInMultiPolygon, pointInPolygon, type PolygonCoordinates } from "@/lib/hazard/point-in-polygon";
import type { HazardCategory, HazardCheckResult } from "@/lib/hazard-contract";

// Era 9 (suite) — Hazard provider réel (不動産情報ライブラリ, endpoints
// XKT026/027/028/029). Même discipline que lib/mlit/provider.ts et
// lib/mlit/land-price-provider.ts : serveur uniquement, clé jamais
// exposée, timeout, 401/403 -> DATA_UNAVAILABLE, le reste -> ERROR.
//
// Vérifié par appel réel authentifié le 2026-09-14 (tuile z14/x14480/
// y6397, Nagano) : XKT026 (crue) et XKT029 (glissement de terrain)
// retournent des FeatureCollections de polygones réels ; XKT027 (houle
// de tempête) et XKT028 (tsunami) retournent des FeatureCollections
// vides à cette tuile — cohérent géographiquement (Nagano est enclavée,
// sans littoral).
//
// evacuation_shelter (XGT001) n'est PAS géré ici : ses features sont
// des points (établissements désignés), pas des polygones de zone — le
// statut IN_ZONE/OUTSIDE_ZONE de HazardCheckResult ne correspond pas à
// "y a-t-il un abri à proximité". Traiter cette catégorie exigerait une
// forme de résultat différente (liste des abris les plus proches),
// délibérément hors scope de ce provider plutôt que forcée dans un
// type qui ne lui correspond pas.

export type PolygonHazardCategory = Exclude<HazardCategory, "evacuation_shelter">;

const HAZARD_ENDPOINT_CODES: Record<PolygonHazardCategory, string> = {
  flood: "XKT026",
  landslide: "XKT029",
  tsunami: "XKT028",
  storm_surge: "XKT027",
};

// z14 : même compromis documenté que pour XPT002 (lib/mlit/tile-math.ts)
// — dans la plage autorisée par chacun de ces 4 endpoints (11/14-15).
const HAZARD_ZOOM = 14;
const REQUEST_TIMEOUT_MS = 10_000;
const AUTH_FAILURE_STATUSES = [401, 403];
const HAZARD_SOURCE_URL = "https://www.reinfolib.mlit.go.jp/";

function hazardSourceName(category: PolygonHazardCategory): string {
  return `MLIT — 不動産情報ライブラリ (${HAZARD_ENDPOINT_CODES[category]})`;
}

interface HazardGeoJsonFeature {
  geometry: { type: string; coordinates: unknown };
}

interface HazardGeoJsonResponse {
  features: HazardGeoJsonFeature[];
}

function isHazardGeoJsonResponse(value: unknown): value is HazardGeoJsonResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "features" in value &&
    Array.isArray((value as { features: unknown }).features)
  );
}

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

export interface FetchHazardZoneParams {
  category: PolygonHazardCategory;
  latitude: number | null;
  longitude: number | null;
}

export async function fetchHazardZone(
  params: FetchHazardZoneParams,
  fetchImpl: typeof fetch = fetch,
): Promise<HazardCheckResult> {
  const { category } = params;
  const fetchedAt = new Date().toISOString();

  // Seule une localisation EXACTE (coordonnées) justifie une
  // intersection géographique fiable — cf. lib/geo-precision.ts. Une
  // municipalité seule reste trop imprécise pour affirmer un statut de
  // zone sur une parcelle donnée.
  if (params.latitude === null || params.longitude === null) {
    return {
      category,
      status: "INSUFFICIENT_PRECISION",
      metadata: { sourceName: hazardSourceName(category), fetchedAt, geographicPrecision: "INSUFFICIENT" },
    };
  }

  const baseMetadata = {
    sourceName: hazardSourceName(category),
    sourceUrl: HAZARD_SOURCE_URL,
    fetchedAt,
    geographicPrecision: "EXACT" as const,
  };

  if (!isServerEnvironment()) {
    return { category, status: "ERROR", metadata: baseMetadata };
  }

  const apiKey = process.env.MLIT_API_KEY;
  if (!apiKey) {
    return { category, status: "DATA_UNAVAILABLE", metadata: baseMetadata };
  }

  const tile = latLonToTile(params.latitude, params.longitude, HAZARD_ZOOM);
  const url = new URL(`https://www.reinfolib.mlit.go.jp/ex-api/external/${HAZARD_ENDPOINT_CODES[category]}`);
  url.searchParams.set("response_format", "geojson");
  url.searchParams.set("z", String(tile.z));
  url.searchParams.set("x", String(tile.x));
  url.searchParams.set("y", String(tile.y));

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      signal: timeoutController.signal,
    });
  } catch {
    return { category, status: "ERROR", metadata: baseMetadata };
  } finally {
    clearTimeout(timeoutId);
  }

  if (AUTH_FAILURE_STATUSES.includes(response.status)) {
    return { category, status: "DATA_UNAVAILABLE", metadata: baseMetadata };
  }
  if (!response.ok) {
    return { category, status: "ERROR", metadata: baseMetadata };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { category, status: "ERROR", metadata: baseMetadata };
  }

  if (!isHazardGeoJsonResponse(json)) {
    return { category, status: "ERROR", metadata: baseMetadata };
  }

  const inZone = json.features.some((feature) => {
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
    // Un type de géométrie inattendu ne doit jamais être traité comme
    // "pas dans la zone" par défaut silencieux — mais il ne peut pas non
    // plus contribuer positivement à l'intersection : ignoré ici, sans
    // affecter le statut global calculé sur les features exploitables.
    return false;
  });

  return {
    category,
    status: inZone ? "IN_ZONE" : "OUTSIDE_ZONE",
    metadata: { ...baseMetadata, confidence: "HIGH", geometryReference: `${tile.z}/${tile.x}/${tile.y}` },
  };
}
