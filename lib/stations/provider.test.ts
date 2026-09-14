import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchNearestStations } from "@/lib/stations/provider";

const BASE_PARAMS = { latitude: 36.65, longitude: 138.18 };

function stationFeature(name: string, coordinates: [number, number][], passengers2023 = 1000) {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: { S12_001_ja: name, S12_002_ja: "長野電鉄", S12_003_ja: "長野線", S12_057: passengers2023 },
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

describe("fetchNearestStations", () => {
  const originalKey = process.env.MLIT_API_KEY;

  beforeEach(() => {
    process.env.MLIT_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.MLIT_API_KEY = originalKey;
  });

  it("FOUND avec les gares triées par distance croissante", async () => {
    const far = stationFeature("Gare lointaine", [
      [138.3, 36.7],
      [138.31, 36.71],
    ]);
    const near = stationFeature("Gare proche", [
      [138.1801, 36.6501],
      [138.1802, 36.6502],
    ]);
    const result = await fetchNearestStations(BASE_PARAMS, mockFetch(geoJsonResponse([far, near])));
    expect(result.status).toBe("FOUND");
    expect(result.stations).toHaveLength(2);
    expect(result.stations[0].info.name).toBe("Gare proche");
  });

  it("porte la fréquentation réelle par année, la plus récente incluse", async () => {
    const feature = stationFeature(
      "善光寺下",
      [
        [138.1801, 36.6501],
        [138.1802, 36.6502],
      ],
      1044,
    );
    const result = await fetchNearestStations(BASE_PARAMS, mockFetch(geoJsonResponse([feature])));
    expect(result.stations[0].info.ridership).toContainEqual({ year: 2023, passengers: 1044 });
  });

  it("NONE_IN_TILE si la tuile ne contient aucune gare, jamais interprété comme aucune gare a proximite", async () => {
    const result = await fetchNearestStations(BASE_PARAMS, mockFetch(geoJsonResponse([])));
    expect(result.status).toBe("NONE_IN_TILE");
  });

  it("ignore une géométrie non-LineString (ex. Point)", async () => {
    const point = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [138.18, 36.65] },
      properties: { S12_001_ja: "駅" },
    };
    const result = await fetchNearestStations(BASE_PARAMS, mockFetch(geoJsonResponse([point])));
    expect(result.status).toBe("NONE_IN_TILE");
  });

  it("INSUFFICIENT_PRECISION sans coordonnées EXACTES", async () => {
    const result = await fetchNearestStations(
      { latitude: null, longitude: 138.18 },
      mockFetch(geoJsonResponse([])),
    );
    expect(result.status).toBe("INSUFFICIENT_PRECISION");
  });

  it("DATA_UNAVAILABLE si la clé est absente", async () => {
    delete process.env.MLIT_API_KEY;
    const result = await fetchNearestStations(BASE_PARAMS, mockFetch(geoJsonResponse([])));
    expect(result.status).toBe("DATA_UNAVAILABLE");
  });

  it("DATA_UNAVAILABLE sur 401/403", async () => {
    expect((await fetchNearestStations(BASE_PARAMS, mockFetchWithStatus(401))).status).toBe(
      "DATA_UNAVAILABLE",
    );
  });

  it("ERROR sur 429 et sur une réponse malformée", async () => {
    expect((await fetchNearestStations(BASE_PARAMS, mockFetchWithStatus(429))).status).toBe("ERROR");
    expect((await fetchNearestStations(BASE_PARAMS, mockFetch({ unexpected: true }))).status).toBe("ERROR");
  });

  it("ERROR sur erreur réseau/timeout", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch;
    expect((await fetchNearestStations(BASE_PARAMS, failing)).status).toBe("ERROR");
  });
});
