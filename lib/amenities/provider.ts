import { latLonToTile } from "@/lib/mlit/tile-math";
import { haversineDistanceMeters } from "@/lib/amenities/distance";

// Era 9 (suite) — provider "services essentiels à proximité" (国土数値
// 情報, XKT006/010/011/017/018 — écoles, établissements médicaux,
// établissements sociaux, équipements culturels, mairies/salles
// communales). Répond enfin à la question déjà listée dans Ask My
// Project "Y a-t-il des services essentiels autour ?", jusqu'ici sans
// réponse.
//
// Vérifié par appels réels authentifiés le 2026-09-15 (tuile
// z14/x14480/y6397, Nagano) : les 5 endpoints renvoient des
// FeatureCollections de Points réels, chacun avec un nom, un type et
// une adresse en clair — un schéma cohérent malgré des noms de champs
// différents par endpoint (P29_xxx pour les écoles, P04_xxx pour le
// médical, etc.), d'où la table de correspondance FIELD_MAP ci-dessous.
//
// Limite honnête et documentée, pas cachée : la recherche ne porte que
// sur la tuile contenant le point (~2,4km de large à cette latitude à
// z14) — l'absence de résultat signifie "aucun établissement trouvé
// dans cette tuile", jamais "aucun établissement à proximité" (un
// établissement plus proche pourrait exister juste de l'autre côté de
// la limite de tuile). Le statut NONE_IN_TILE le distingue
// explicitement d'un statut qui affirmerait une absence réelle.
//
// XKT015 (fréquentation des gares) volontairement laissé de côté :
// vérifié en conditions réelles que sa géométrie est un LineString
// (segment ferroviaire), pas un Point — une approche différente
// (distance à un segment, interprétation de champs S12_xxx non
// documentés dans le résumé consulté) serait nécessaire, hors scope de
// ce provider plutôt que forcée sur l'infrastructure "point le plus
// proche" construite ici.

export type AmenityCategory = "school" | "medical" | "welfare" | "cultural" | "town_hall";

export const AMENITY_CATEGORY_LABELS: Record<AmenityCategory, string> = {
  school: "🏫 École",
  medical: "🏥 Établissement médical",
  welfare: "🤝 Établissement social",
  cultural: "📚 Équipement culturel (bibliothèque, etc.)",
  town_hall: "🏛️ Mairie / salle communale",
};

const AMENITY_ENDPOINT_CODES: Record<AmenityCategory, string> = {
  school: "XKT006",
  medical: "XKT010",
  welfare: "XKT011",
  cultural: "XKT017",
  town_hall: "XKT018",
};

// Champs vérifiés par appel réel pour chaque endpoint — jamais devinés
// à partir d'une convention supposée uniforme (les codes de champs
// diffèrent réellement d'un endpoint à l'autre).
const FIELD_MAP: Record<AmenityCategory, { name: string; type: string }> = {
  school: { name: "P29_004_ja", type: "P29_003_name_ja" },
  medical: { name: "P04_002_ja", type: "P04_001_name_ja" },
  welfare: { name: "P14_008_ja", type: "P14_006_name_ja" },
  cultural: { name: "P27_005_ja", type: "P27_004_name_ja" },
  town_hall: { name: "P05_003_ja", type: "P05_002_name_ja" },
};

const AMENITY_ZOOM = 14;
const REQUEST_TIMEOUT_MS = 10_000;
const AUTH_FAILURE_STATUSES = [401, 403];
const AMENITY_SOURCE_URL = "https://www.reinfolib.mlit.go.jp/";

export type AmenitySearchStatus =
  | "FOUND"
  | "NONE_IN_TILE"
  | "INSUFFICIENT_PRECISION"
  | "DATA_UNAVAILABLE"
  | "ERROR";

export interface NearestAmenity {
  name: string;
  facilityType: string;
  distanceMeters: number;
}

export interface AmenitySearchMetadata {
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
}

export interface AmenitySearchResult {
  category: AmenityCategory;
  status: AmenitySearchStatus;
  // Triés par distance croissante — jamais réordonnés ailleurs.
  amenities: NearestAmenity[];
  metadata: AmenitySearchMetadata;
}

function amenitySourceName(category: AmenityCategory): string {
  return `MLIT — 国土数値情報 (${AMENITY_ENDPOINT_CODES[category]})`;
}

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

interface AmenityGeoJsonFeature {
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

interface AmenityGeoJsonResponse {
  features: AmenityGeoJsonFeature[];
}

function isAmenityGeoJsonResponse(value: unknown): value is AmenityGeoJsonResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "features" in value &&
    Array.isArray((value as { features: unknown }).features)
  );
}

export interface FetchNearestAmenitiesParams {
  category: AmenityCategory;
  latitude: number | null;
  longitude: number | null;
}

export async function fetchNearestAmenities(
  params: FetchNearestAmenitiesParams,
  fetchImpl: typeof fetch = fetch,
): Promise<AmenitySearchResult> {
  const { category } = params;
  const fetchedAt = new Date().toISOString();
  const metadata: AmenitySearchMetadata = {
    sourceName: amenitySourceName(category),
    sourceUrl: AMENITY_SOURCE_URL,
    fetchedAt,
  };

  if (params.latitude === null || params.longitude === null) {
    return { category, status: "INSUFFICIENT_PRECISION", amenities: [], metadata };
  }

  if (!isServerEnvironment()) {
    return { category, status: "ERROR", amenities: [], metadata };
  }

  const apiKey = process.env.MLIT_API_KEY;
  if (!apiKey) {
    return { category, status: "DATA_UNAVAILABLE", amenities: [], metadata };
  }

  const tile = latLonToTile(params.latitude, params.longitude, AMENITY_ZOOM);
  const url = new URL(`https://www.reinfolib.mlit.go.jp/ex-api/external/${AMENITY_ENDPOINT_CODES[category]}`);
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
    return { category, status: "ERROR", amenities: [], metadata };
  } finally {
    clearTimeout(timeoutId);
  }

  if (AUTH_FAILURE_STATUSES.includes(response.status)) {
    return { category, status: "DATA_UNAVAILABLE", amenities: [], metadata };
  }
  if (!response.ok) {
    return { category, status: "ERROR", amenities: [], metadata };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { category, status: "ERROR", amenities: [], metadata };
  }

  if (!isAmenityGeoJsonResponse(json)) {
    return { category, status: "ERROR", amenities: [], metadata };
  }

  const fields = FIELD_MAP[category];
  const amenities: NearestAmenity[] = [];
  for (const feature of json.features) {
    if (feature.geometry.type !== "Point") continue;
    const coords = feature.geometry.coordinates as [number, number];
    const [lon, lat] = coords;
    const name = feature.properties[fields.name];
    const facilityType = feature.properties[fields.type];
    if (typeof name !== "string" || name.trim() === "") continue;
    amenities.push({
      name,
      facilityType: typeof facilityType === "string" && facilityType.trim() !== "" ? facilityType : "—",
      distanceMeters: haversineDistanceMeters(params.latitude, params.longitude, lat, lon),
    });
  }

  amenities.sort((a, b) => a.distanceMeters - b.distanceMeters);

  return {
    category,
    status: amenities.length > 0 ? "FOUND" : "NONE_IN_TILE",
    amenities,
    metadata,
  };
}
