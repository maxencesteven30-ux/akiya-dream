import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchPopulationProjection } from "@/lib/demographics/provider";

const BASE_PARAMS = { latitude: 36.65, longitude: 138.18 };

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

function geoJsonResponse(cells: { geometry: unknown; properties: Record<string, unknown> }[]) {
  return {
    type: "FeatureCollection",
    features: cells.map(({ geometry, properties }) => ({ type: "Feature", geometry, properties })),
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

describe("fetchPopulationProjection", () => {
  const originalKey = process.env.MLIT_API_KEY;

  beforeEach(() => {
    process.env.MLIT_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.MLIT_API_KEY = originalKey;
  });

  it("AVAILABLE avec les points démographiques de la cellule contenant le point", async () => {
    const cell = {
      geometry: squarePolygonAround(BASE_PARAMS.latitude, BASE_PARAMS.longitude),
      properties: { PT00_2025: 12.1, RTD_2025: 0.25, HITOKU2025: "" },
    };
    const result = await fetchPopulationProjection(BASE_PARAMS, mockFetch(geoJsonResponse([cell])));
    expect(result.status).toBe("AVAILABLE");
    expect(result.data).toEqual([
      { year: 2025, totalPopulation: 12.1, elderlyRatio75Plus: 0.25, suppressed: false },
    ]);
  });

  it("choisit la cellule qui contient réellement le point, jamais une cellule voisine au hasard", async () => {
    const farCell = {
      geometry: squarePolygonAround(0, 0),
      properties: { PT00_2025: 999, HITOKU2025: "" },
    };
    const correctCell = {
      geometry: squarePolygonAround(BASE_PARAMS.latitude, BASE_PARAMS.longitude),
      properties: { PT00_2025: 12.1, HITOKU2025: "" },
    };
    const result = await fetchPopulationProjection(BASE_PARAMS, mockFetch(geoJsonResponse([farCell, correctCell])));
    expect(result.data?.[0].totalPopulation).toBe(12.1);
  });

  it("NOT_FOUND si aucune cellule ne couvre le point, jamais interprété comme population nulle", async () => {
    const farCell = { geometry: squarePolygonAround(0, 0), properties: { PT00_2025: 999 } };
    const result = await fetchPopulationProjection(BASE_PARAMS, mockFetch(geoJsonResponse([farCell])));
    expect(result.status).toBe("NOT_FOUND");
  });

  it("INSUFFICIENT_LOCATION sans coordonnées EXACTES", async () => {
    const result = await fetchPopulationProjection(
      { latitude: null, longitude: 138.18 },
      mockFetch(geoJsonResponse([])),
    );
    expect(result.status).toBe("INSUFFICIENT_LOCATION");
  });

  it("UNAVAILABLE si la clé est absente", async () => {
    delete process.env.MLIT_API_KEY;
    const result = await fetchPopulationProjection(BASE_PARAMS, mockFetch(geoJsonResponse([])));
    expect(result.status).toBe("UNAVAILABLE");
  });

  it("UNAVAILABLE sur 401/403", async () => {
    expect((await fetchPopulationProjection(BASE_PARAMS, mockFetchWithStatus(401))).status).toBe("UNAVAILABLE");
  });

  it("ERROR sur 429 et sur une réponse malformée", async () => {
    expect((await fetchPopulationProjection(BASE_PARAMS, mockFetchWithStatus(429))).status).toBe("ERROR");
    expect((await fetchPopulationProjection(BASE_PARAMS, mockFetch({ unexpected: true }))).status).toBe("ERROR");
  });

  it("ERROR sur erreur réseau/timeout", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch;
    expect((await fetchPopulationProjection(BASE_PARAMS, failing)).status).toBe("ERROR");
  });

  it("précision géographique toujours APPROXIMATE (cellule ~250m)", async () => {
    const cell = {
      geometry: squarePolygonAround(BASE_PARAMS.latitude, BASE_PARAMS.longitude),
      properties: { PT00_2025: 12.1 },
    };
    const result = await fetchPopulationProjection(BASE_PARAMS, mockFetch(geoJsonResponse([cell])));
    expect(result.metadata.geographicPrecision).toBe("APPROXIMATE");
  });
});
