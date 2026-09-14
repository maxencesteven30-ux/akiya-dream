import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchOfficialLandPrice } from "@/lib/mlit/land-price-provider";
import type { LandPricePointRaw } from "@/lib/mlit/land-price-types";

function rawPoint(overrides: Partial<LandPricePointRaw> = {}): LandPricePointRaw {
  return {
    point_id: 1,
    land_price_type: 0,
    target_year_name_ja: "令和6年1月1日",
    prefecture_code: "20",
    prefecture_name_ja: "長野県",
    city_code: "20201",
    city_county_name_ja: "長野市",
    ward_town_village_name_ja: "",
    place_name_ja: "長野",
    location_number_ja: "SYNTHETIC",
    standard_lot_number_ja: "長野5-11",
    use_category_name_ja: "住宅地",
    u_current_years_price_ja: "50,000(円/㎡)",
    last_years_price: 50_000,
    year_on_year_change_rate: "0.0",
    u_cadastral_ja: "200(㎡)",
    nearest_station_name_ja: "長野",
    u_road_distance_to_nearest_station_name_ja: "1000m",
    ...overrides,
  };
}

function geoJsonResponse(points: LandPricePointRaw[]) {
  return {
    type: "FeatureCollection",
    features: points.map((properties) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [138.18, 36.65] },
      properties,
    })),
  };
}

function mockFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }) as unknown as typeof fetch;
}

function mockFetchWithStatus(status: number): typeof fetch {
  return vi
    .fn()
    .mockResolvedValue({ ok: false, status, json: () => Promise.resolve({}) }) as unknown as typeof fetch;
}

const BASE_PARAMS = { latitude: 36.65, longitude: 138.18, year: 2024 };

describe("fetchOfficialLandPrice", () => {
  const originalKey = process.env.MLIT_API_KEY;

  beforeEach(() => {
    process.env.MLIT_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.MLIT_API_KEY = originalKey;
  });

  it("AVAILABLE avec les points normalisés quand la réponse contient des données", async () => {
    const result = await fetchOfficialLandPrice(BASE_PARAMS, mockFetch(geoJsonResponse([rawPoint()])));
    expect(result.status).toBe("AVAILABLE");
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].pricePerSqmJpy).toBe(50_000);
  });

  it("NOT_FOUND quand la tuile ne contient aucun point, jamais interprété comme un prix nul", async () => {
    const result = await fetchOfficialLandPrice(BASE_PARAMS, mockFetch(geoJsonResponse([])));
    expect(result.status).toBe("NOT_FOUND");
    expect(result.data).toEqual([]);
  });

  it("INSUFFICIENT_LOCATION sans coordonnées EXACTES, jamais dérivé de la municipalité seule", async () => {
    const result = await fetchOfficialLandPrice(
      { latitude: null, longitude: 138.18, year: 2024 },
      mockFetch(geoJsonResponse([rawPoint()])),
    );
    expect(result.status).toBe("INSUFFICIENT_LOCATION");
    expect(result.metadata.geographicPrecision).toBe("INSUFFICIENT");
  });

  it("UNAVAILABLE si la clé est absente, jamais confondu avec NOT_FOUND", async () => {
    delete process.env.MLIT_API_KEY;
    const result = await fetchOfficialLandPrice(BASE_PARAMS, mockFetch(geoJsonResponse([rawPoint()])));
    expect(result.status).toBe("UNAVAILABLE");
  });

  it("UNAVAILABLE sur 401/403 (clé invalide)", async () => {
    expect((await fetchOfficialLandPrice(BASE_PARAMS, mockFetchWithStatus(401))).status).toBe("UNAVAILABLE");
    expect((await fetchOfficialLandPrice(BASE_PARAMS, mockFetchWithStatus(403))).status).toBe("UNAVAILABLE");
  });

  it("ERROR sur 429 et sur une réponse malformée", async () => {
    expect((await fetchOfficialLandPrice(BASE_PARAMS, mockFetchWithStatus(429))).status).toBe("ERROR");
    expect((await fetchOfficialLandPrice(BASE_PARAMS, mockFetch({ unexpected: true }))).status).toBe("ERROR");
  });

  it("ERROR sur erreur réseau/timeout, jamais un blocage", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    expect((await fetchOfficialLandPrice(BASE_PARAMS, failing)).status).toBe("ERROR");
  });

  it("précision géographique toujours APPROXIMATE (tuile ~2,4km), jamais présentée comme la parcelle exacte", async () => {
    const result = await fetchOfficialLandPrice(BASE_PARAMS, mockFetch(geoJsonResponse([rawPoint()])));
    expect(result.metadata.geographicPrecision).toBe("APPROXIMATE");
  });

  it("filtre les points au prix non exploitable, jamais un prix inventé", async () => {
    const result = await fetchOfficialLandPrice(
      BASE_PARAMS,
      mockFetch(geoJsonResponse([rawPoint({ u_current_years_price_ja: "" })])),
    );
    expect(result.status).toBe("NOT_FOUND");
  });

  it("transmet un AbortSignal à fetch (timeout réellement câblé)", async () => {
    const fetchSpy = mockFetch(geoJsonResponse([rawPoint()]));
    await fetchOfficialLandPrice(BASE_PARAMS, fetchSpy);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
