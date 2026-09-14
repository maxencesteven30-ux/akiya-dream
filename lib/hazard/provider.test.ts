import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchHazardZone } from "@/lib/hazard/provider";

// Coordonnées Nagano déjà vérifiées ce jour par appel réel authentifié
// (z14/x14480/y6397) — mêmes coordonnées que land-price-provider.test.ts.
const BASE_PARAMS = { category: "flood" as const, latitude: 36.65, longitude: 138.18 };

function squarePolygonAround(lat: number, lon: number) {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lon - 0.01, lat - 0.01],
        [lon + 0.01, lat - 0.01],
        [lon + 0.01, lat + 0.01],
        [lon - 0.01, lat + 0.01],
        [lon - 0.01, lat - 0.01],
      ],
    ],
  };
}

function geoJsonResponse(geometries: { type: string; coordinates: unknown }[]) {
  return {
    type: "FeatureCollection",
    features: geometries.map((geometry) => ({ type: "Feature", geometry, properties: {} })),
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

describe("fetchHazardZone", () => {
  const originalKey = process.env.MLIT_API_KEY;

  beforeEach(() => {
    process.env.MLIT_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.MLIT_API_KEY = originalKey;
  });

  it("IN_ZONE quand le point se trouve dans une feature polygone retournée", async () => {
    const polygon = squarePolygonAround(BASE_PARAMS.latitude, BASE_PARAMS.longitude);
    const result = await fetchHazardZone(BASE_PARAMS, mockFetch(geoJsonResponse([polygon])));
    expect(result.status).toBe("IN_ZONE");
    expect(result.category).toBe("flood");
  });

  it("OUTSIDE_ZONE quand des features existent dans la tuile mais aucune ne contient le point", async () => {
    const farPolygon = squarePolygonAround(0, 0);
    const result = await fetchHazardZone(BASE_PARAMS, mockFetch(geoJsonResponse([farPolygon])));
    expect(result.status).toBe("OUTSIDE_ZONE");
  });

  it("OUTSIDE_ZONE quand la tuile ne contient aucune feature, jamais interprété comme une erreur", async () => {
    const result = await fetchHazardZone(BASE_PARAMS, mockFetch(geoJsonResponse([])));
    expect(result.status).toBe("OUTSIDE_ZONE");
  });

  it("gère un MultiPolygon exactement comme une liste de Polygon", async () => {
    const inner = squarePolygonAround(BASE_PARAMS.latitude, BASE_PARAMS.longitude).coordinates;
    const multi = { type: "MultiPolygon", coordinates: [inner] };
    const result = await fetchHazardZone(BASE_PARAMS, mockFetch(geoJsonResponse([multi])));
    expect(result.status).toBe("IN_ZONE");
  });

  it("INSUFFICIENT_PRECISION sans coordonnées EXACTES, jamais dérivé d'une municipalité seule", async () => {
    const result = await fetchHazardZone(
      { category: "flood", latitude: null, longitude: 138.18 },
      mockFetch(geoJsonResponse([])),
    );
    expect(result.status).toBe("INSUFFICIENT_PRECISION");
    expect(result.metadata.geographicPrecision).toBe("INSUFFICIENT");
  });

  it("DATA_UNAVAILABLE si la clé est absente, jamais confondu avec OUTSIDE_ZONE", async () => {
    delete process.env.MLIT_API_KEY;
    const result = await fetchHazardZone(BASE_PARAMS, mockFetch(geoJsonResponse([])));
    expect(result.status).toBe("DATA_UNAVAILABLE");
  });

  it("DATA_UNAVAILABLE sur 401/403 (clé invalide)", async () => {
    expect((await fetchHazardZone(BASE_PARAMS, mockFetchWithStatus(401))).status).toBe("DATA_UNAVAILABLE");
    expect((await fetchHazardZone(BASE_PARAMS, mockFetchWithStatus(403))).status).toBe("DATA_UNAVAILABLE");
  });

  it("ERROR sur 429 et sur une réponse malformée", async () => {
    expect((await fetchHazardZone(BASE_PARAMS, mockFetchWithStatus(429))).status).toBe("ERROR");
    expect((await fetchHazardZone(BASE_PARAMS, mockFetch({ unexpected: true }))).status).toBe("ERROR");
  });

  it("ERROR sur erreur réseau/timeout, jamais un blocage", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    expect((await fetchHazardZone(BASE_PARAMS, failing)).status).toBe("ERROR");
  });

  it("transmet un AbortSignal à fetch (timeout réellement câblé)", async () => {
    const fetchSpy = mockFetch(geoJsonResponse([]));
    await fetchHazardZone(BASE_PARAMS, fetchSpy);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("interroge le bon endpoint MLIT selon la catégorie", async () => {
    const fetchSpy = mockFetch(geoJsonResponse([]));
    await fetchHazardZone({ category: "tsunami", latitude: 36.65, longitude: 138.18 }, fetchSpy);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("XKT028"), expect.anything());
  });

  it("un type de géométrie inattendu n'est jamais compté comme une intersection", async () => {
    const result = await fetchHazardZone(
      BASE_PARAMS,
      mockFetch(geoJsonResponse([{ type: "LineString", coordinates: [[0, 0], [1, 1]] }])),
    );
    expect(result.status).toBe("OUTSIDE_ZONE");
  });
});
