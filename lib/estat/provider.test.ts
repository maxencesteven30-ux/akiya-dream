import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchMunicipalityIndicator } from "@/lib/estat/provider";

function apiResponse(values: { cat01: string; time: string; value: string }[], status = 0) {
  return {
    GET_STATS_DATA: {
      RESULT: { STATUS: status },
      STATISTICAL_DATA: {
        DATA_INF: { VALUE: values.map((v) => ({ "@cat01": v.cat01, "@time": v.time, $: v.value })) },
      },
    },
  };
}

function mockFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }) as unknown as typeof fetch;
}

describe("fetchMunicipalityIndicator", () => {
  const originalKey = process.env.ESTAT_APP_ID;

  beforeEach(() => {
    process.env.ESTAT_APP_ID = "test-app-id";
  });

  afterEach(() => {
    process.env.ESTAT_APP_ID = originalKey;
  });

  it("AVAILABLE avec la population la plus récente (déclin réel de Nagano vérifié)", async () => {
    const body = apiResponse([
      { cat01: "A1101", time: "2015100000", value: "377598" },
      { cat01: "A1101", time: "2020100000", value: "372760" },
    ]);
    const result = await fetchMunicipalityIndicator("20201", "population", mockFetch(body));
    expect(result.status).toBe("AVAILABLE");
    expect(result.data).toEqual({
      municipalityCode: "20201",
      indicator: "population",
      period: "2020",
      value: 372760,
      unit: "人",
    });
  });

  it("AVAILABLE avec les ménages (cat01 A7101, jamais confondu avec la population)", async () => {
    const body = apiResponse([{ cat01: "A7101", time: "2020100000", value: "150000" }]);
    const result = await fetchMunicipalityIndicator("20201", "households", mockFetch(body));
    expect(result.data?.value).toBe(150000);
    expect(result.data?.unit).toBe("世帯");
  });

  it("AVAILABLE pour population_change_rate, avec les deux années explicites dans period", async () => {
    const body = apiResponse([
      { cat01: "A1101", time: "2015100000", value: "377598" },
      { cat01: "A1101", time: "2020100000", value: "372760" },
    ]);
    const result = await fetchMunicipalityIndicator("20201", "population_change_rate", mockFetch(body));
    expect(result.data?.period).toBe("2015→2020");
    expect(result.data?.value).toBeCloseTo(-1.281, 2);
    expect(result.data?.unit).toBe("%");
  });

  it("NOT_FOUND pour population_change_rate si une seule année disponible, jamais un taux inventé", async () => {
    const body = apiResponse([{ cat01: "A1101", time: "2020100000", value: "372760" }]);
    const result = await fetchMunicipalityIndicator("20201", "population_change_rate", mockFetch(body));
    expect(result.status).toBe("NOT_FOUND");
  });

  it("INSUFFICIENT_DATA sans code municipal", async () => {
    const result = await fetchMunicipalityIndicator(null, "population", mockFetch(apiResponse([])));
    expect(result.status).toBe("INSUFFICIENT_DATA");
  });

  it("DATA_UNAVAILABLE si ESTAT_APP_ID est absent", async () => {
    delete process.env.ESTAT_APP_ID;
    const result = await fetchMunicipalityIndicator("20201", "population", mockFetch(apiResponse([])));
    expect(result.status).toBe("DATA_UNAVAILABLE");
  });

  it("DATA_UNAVAILABLE si RESULT.STATUS n'est pas 0 (appId invalide, vérifié en conditions réelles : HTTP 200 avec STATUS 100)", async () => {
    const result = await fetchMunicipalityIndicator(
      "20201",
      "population",
      mockFetch(apiResponse([], 100)),
    );
    expect(result.status).toBe("DATA_UNAVAILABLE");
  });

  it("ERROR sur une réponse HTTP non ok ou malformée", async () => {
    expect((await fetchMunicipalityIndicator("20201", "population", mockFetch({}, false))).status).toBe(
      "ERROR",
    );
    expect(
      (await fetchMunicipalityIndicator("20201", "population", mockFetch({ unexpected: true }))).status,
    ).toBe("ERROR");
  });

  it("ERROR sur erreur réseau/timeout, jamais un blocage", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch;
    expect((await fetchMunicipalityIndicator("20201", "population", failing)).status).toBe("ERROR");
  });

  it("NOT_FOUND si la série ne contient aucune valeur exploitable pour ce municipalityCode", async () => {
    const result = await fetchMunicipalityIndicator("20201", "population", mockFetch(apiResponse([])));
    expect(result.status).toBe("NOT_FOUND");
  });
});
