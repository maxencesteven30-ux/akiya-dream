// AD.2 — 地価公示・地価調査 (XPT002). Forme vérifiée par un appel réel
// authentifié le 2026-09-14 (GeoJSON, tuile z14/x14480/y6397, ville
// 20201/長野市). Volontairement un modèle SÉPARÉ de MlitTransaction
// (lib/mlit/types.ts) : OFFICIAL_LAND_PRICE (prix officiel du terrain
// seul, au m²) n'est PAS TRANSACTION_PRICE (prix réel d'une transaction
// terrain+bâtiment) — les fusionner sous un champ `price` ambigu serait
// trompeur.

export interface LandPricePointRaw {
  point_id: number;
  land_price_type: number;
  target_year_name_ja: string;
  prefecture_code: string;
  prefecture_name_ja: string;
  city_code: string;
  city_county_name_ja: string;
  ward_town_village_name_ja: string;
  place_name_ja: string;
  location_number_ja: string;
  standard_lot_number_ja: string;
  use_category_name_ja: string;
  u_current_years_price_ja: string;
  last_years_price: number;
  year_on_year_change_rate: string;
  u_cadastral_ja: string;
  nearest_station_name_ja: string;
  u_road_distance_to_nearest_station_name_ja: string;
}

export interface LandPriceGeoJsonFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: LandPricePointRaw;
}

export interface LandPriceGeoJsonResponse {
  type: "FeatureCollection";
  features: LandPriceGeoJsonFeature[];
}

// 0 = 地価公示 (national, 公示地価), 1 = 都道府県地価調査 (prefectural) —
// valeurs confirmées par la doc XPT002 (paramètre priceClassification) et
// observées telles quelles dans une réponse réelle.
export type OfficialLandPriceType = "national" | "prefectural";

function parseLandPriceType(raw: number): OfficialLandPriceType | null {
  if (raw === 0) return "national";
  if (raw === 1) return "prefectural";
  return null;
}

// "102,000(円/㎡)" -> 102000. Retourne null si le format ne correspond
// pas exactement à celui observé — jamais un prix deviné.
function parsePricePerSqm(raw: string): number | null {
  const match = raw.match(/^([\d,]+)\(円\/㎡\)$/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function parseOptionalString(raw: string): string | null {
  return raw.trim() === "" ? null : raw;
}

export interface OfficialLandPricePoint {
  pointId: number;
  priceType: OfficialLandPriceType;
  targetYear: string;
  prefecture: string;
  municipality: string;
  placeName: string | null;
  standardLotNumber: string | null;
  useCategory: string | null;
  pricePerSqmJpy: number;
  cityCode: string;
  latitude: number;
  longitude: number;
}

// Un point dont le prix ou le type ne sont pas exploitables est rejeté —
// jamais affiché avec une donnée devinée.
export function parseLandPriceFeature(feature: LandPriceGeoJsonFeature): OfficialLandPricePoint | null {
  const priceType = parseLandPriceType(feature.properties.land_price_type);
  const pricePerSqmJpy = parsePricePerSqm(feature.properties.u_current_years_price_ja);
  if (priceType === null || pricePerSqmJpy === null) return null;

  return {
    pointId: feature.properties.point_id,
    priceType,
    targetYear: feature.properties.target_year_name_ja,
    prefecture: feature.properties.prefecture_name_ja,
    municipality: feature.properties.city_county_name_ja,
    placeName: parseOptionalString(feature.properties.place_name_ja),
    standardLotNumber: parseOptionalString(feature.properties.standard_lot_number_ja),
    useCategory: parseOptionalString(feature.properties.use_category_name_ja),
    pricePerSqmJpy,
    cityCode: feature.properties.city_code,
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1],
  };
}
