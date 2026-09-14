import { describe, expect, it } from "vitest";
import { parseLandPriceFeature, type LandPricePointRaw } from "@/lib/mlit/land-price-types";

// Propriétés issues d'une réponse réelle de l'API XPT002 (vérifiée
// manuellement le 2026-09-14, tuile z14/x14480/y6397, Nagano) — pas une
// fixture inventée.
const REAL_SHAPE_PROPERTIES: LandPricePointRaw = {
  point_id: 3016004,
  land_price_type: 0,
  target_year_name_ja: "令和6年1月1日",
  prefecture_code: "20",
  prefecture_name_ja: "長野県",
  city_code: "20201",
  city_county_name_ja: "長野市",
  ward_town_village_name_ja: "",
  place_name_ja: "長野",
  location_number_ja: "大字南長野字石堂南１２６２番１２",
  standard_lot_number_ja: "長野5-11",
  use_category_name_ja: "商業地",
  u_current_years_price_ja: "102,000(円/㎡)",
  last_years_price: 102000,
  year_on_year_change_rate: "0.0",
  u_cadastral_ja: "122(㎡)",
  nearest_station_name_ja: "長野",
  u_road_distance_to_nearest_station_name_ja: "340m",
};

function feature(properties: Partial<LandPricePointRaw> = {}) {
  return {
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [138.185675740242, 36.64555891244794] as [number, number] },
    properties: { ...REAL_SHAPE_PROPERTIES, ...properties },
  };
}

describe("parseLandPriceFeature", () => {
  it("normalise un point réel sans rien inventer", () => {
    const result = parseLandPriceFeature(feature());
    expect(result).toEqual({
      pointId: 3016004,
      priceType: "national",
      targetYear: "令和6年1月1日",
      prefecture: "長野県",
      municipality: "長野市",
      placeName: "長野",
      standardLotNumber: "長野5-11",
      useCategory: "商業地",
      pricePerSqmJpy: 102_000,
      cityCode: "20201",
      longitude: 138.185675740242,
      latitude: 36.64555891244794,
    });
  });

  it("distingue national (0) et prefectural (1), jamais fusionnés", () => {
    expect(parseLandPriceFeature(feature({ land_price_type: 1 }))?.priceType).toBe("prefectural");
    expect(parseLandPriceFeature(feature({ land_price_type: 0 }))?.priceType).toBe("national");
  });

  it("rejette un land_price_type inconnu plutôt que de deviner", () => {
    expect(parseLandPriceFeature(feature({ land_price_type: 5 }))).toBeNull();
  });

  it("rejette un prix non parsable, jamais un prix à 0 inventé", () => {
    expect(parseLandPriceFeature(feature({ u_current_years_price_ja: "" }))).toBeNull();
    expect(parseLandPriceFeature(feature({ u_current_years_price_ja: "非公開" }))).toBeNull();
  });

  it("parse correctement le format '102,000(円/㎡)' avec virgule de milliers", () => {
    expect(parseLandPriceFeature(feature())?.pricePerSqmJpy).toBe(102_000);
  });

  it("champs optionnels vides deviennent null, jamais une chaîne vide affichée", () => {
    const result = parseLandPriceFeature(feature({ place_name_ja: "" }));
    expect(result?.placeName).toBeNull();
  });
});
