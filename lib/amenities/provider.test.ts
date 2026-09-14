import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchNearestAmenities } from "@/lib/amenities/provider";

const BASE_PARAMS = { category: "school" as const, latitude: 36.65, longitude: 138.18 };

function schoolFeature(name: string, type: string, lat: number, lon: number) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: { P29_004_ja: name, P29_003_name_ja: type },
  };
}

function geoJsonResponse(features: unknown[]) {
  return { type: "FeatureCollection", features };
}

function mockFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }) as unknown as typeof fetch;
}

function mockFetchWithStatus(status: number): typeof fetch {
  return vi
    .fn()
    .mockResolvedValue({ ok: false, status, json: () => Promise.resolve({}) }) as unknown as typeof fetch;
}

describe("fetchNearestAmenities", () => {
  const originalKey = process.env.MLIT_API_KEY;

  beforeEach(() => {
    process.env.MLIT_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.MLIT_API_KEY = originalKey;
  });

  it("FOUND avec les établissements triés par distance croissante", async () => {
    const far = schoolFeature("École lointaine", "小学校", 36.7, 138.3);
    const near = schoolFeature("École proche", "小学校", 36.6501, 138.1801);
    const result = await fetchNearestAmenities(BASE_PARAMS, mockFetch(geoJsonResponse([far, near])));
    expect(result.status).toBe("FOUND");
    expect(result.amenities).toHaveLength(2);
    expect(result.amenities[0].name).toBe("École proche");
    expect(result.amenities[0].distanceMeters).toBeLessThan(result.amenities[1].distanceMeters);
  });

  it("utilise le bon champ selon la catégorie (médical, jamais confondu avec les écoles)", async () => {
    const feature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [138.1801, 36.6501] },
      properties: { P04_002_ja: "Clinique Nagano", P04_001_name_ja: "診療所" },
    };
    const result = await fetchNearestAmenities(
      { category: "medical", latitude: 36.65, longitude: 138.18 },
      mockFetch(geoJsonResponse([feature])),
    );
    expect(result.amenities[0].name).toBe("Clinique Nagano");
    expect(result.amenities[0].facilityType).toBe("診療所");
  });

  it("NONE_IN_TILE si la tuile ne contient aucun établissement, jamais interprété comme aucun service a proximite", async () => {
    const result = await fetchNearestAmenities(BASE_PARAMS, mockFetch(geoJsonResponse([])));
    expect(result.status).toBe("NONE_IN_TILE");
  });

  it("ignore une feature sans nom exploitable, jamais un nom inventé", async () => {
    const noName = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [138.18, 36.65] },
      properties: { P29_003_name_ja: "小学校" },
    };
    const result = await fetchNearestAmenities(BASE_PARAMS, mockFetch(geoJsonResponse([noName])));
    expect(result.status).toBe("NONE_IN_TILE");
    expect(result.amenities).toEqual([]);
  });

  it("INSUFFICIENT_PRECISION sans coordonnées EXACTES", async () => {
    const result = await fetchNearestAmenities(
      { category: "school", latitude: null, longitude: 138.18 },
      mockFetch(geoJsonResponse([])),
    );
    expect(result.status).toBe("INSUFFICIENT_PRECISION");
  });

  it("DATA_UNAVAILABLE si la clé est absente", async () => {
    delete process.env.MLIT_API_KEY;
    const result = await fetchNearestAmenities(BASE_PARAMS, mockFetch(geoJsonResponse([])));
    expect(result.status).toBe("DATA_UNAVAILABLE");
  });

  it("DATA_UNAVAILABLE sur 401/403", async () => {
    expect((await fetchNearestAmenities(BASE_PARAMS, mockFetchWithStatus(401))).status).toBe(
      "DATA_UNAVAILABLE",
    );
  });

  it("ERROR sur 429 et sur une réponse malformée", async () => {
    expect((await fetchNearestAmenities(BASE_PARAMS, mockFetchWithStatus(429))).status).toBe("ERROR");
    expect((await fetchNearestAmenities(BASE_PARAMS, mockFetch({ unexpected: true }))).status).toBe("ERROR");
  });

  it("ERROR sur erreur réseau/timeout", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch;
    expect((await fetchNearestAmenities(BASE_PARAMS, failing)).status).toBe("ERROR");
  });

  it("ignore une géométrie non-Point (ex. LineString), jamais une distance calculée sur une forme non gérée", async () => {
    const line = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[138.18, 36.65], [138.19, 36.66]] },
      properties: { P29_004_ja: "École ligne", P29_003_name_ja: "小学校" },
    };
    const result = await fetchNearestAmenities(BASE_PARAMS, mockFetch(geoJsonResponse([line])));
    expect(result.status).toBe("NONE_IN_TILE");
  });
});
