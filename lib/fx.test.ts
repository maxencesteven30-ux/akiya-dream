import { describe, expect, it, vi } from "vitest";
import { computeFxSensitivity, fetchEurJpyRate } from "@/lib/fx";

function mockFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe("fetchEurJpyRate", () => {
  it("retourne AVAILABLE avec le taux, la date source et la confiance HIGH", async () => {
    const result = await fetchEurJpyRate(
      mockFetch({ amount: 1, base: "EUR", date: "2026-09-11", rates: { JPY: 178.56 } }),
    );
    expect(result.status).toBe("AVAILABLE");
    expect(result.data).toEqual({ pair: "EUR/JPY", rate: 178.56, sourceDate: "2026-09-11" });
    expect(result.metadata.sourceDate).toBe("2026-09-11");
    expect(result.metadata.confidence).toBe("HIGH");
    expect(result.metadata.fetchedAt).toBeTruthy();
  });

  it("retourne ERROR si la requête réseau échoue", async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await fetchEurJpyRate(failingFetch);
    expect(result.status).toBe("ERROR");
    expect(result.data).toBeUndefined();
  });

  it("retourne ERROR si la réponse HTTP n'est pas ok", async () => {
    const result = await fetchEurJpyRate(mockFetch({}, false));
    expect(result.status).toBe("ERROR");
  });

  it("retourne NOT_FOUND si la réponse ne contient pas le taux attendu (jamais inventé)", async () => {
    const result = await fetchEurJpyRate(mockFetch({ date: "2026-09-11", rates: {} }));
    expect(result.status).toBe("NOT_FOUND");
    expect(result.data).toBeUndefined();
  });
});

describe("computeFxSensitivity", () => {
  it("simule des paliers autour du taux actuel sans jamais prédire le marché", () => {
    const points = computeFxSensitivity(180);
    const expected = [
      { deltaPercent: -10, rate: 162 },
      { deltaPercent: -5, rate: 171 },
      { deltaPercent: 0, rate: 180 },
      { deltaPercent: 5, rate: 189 },
      { deltaPercent: 10, rate: 198 },
    ];
    expect(points).toHaveLength(expected.length);
    points.forEach((point, i) => {
      expect(point.deltaPercent).toBe(expected[i].deltaPercent);
      expect(point.rate).toBeCloseTo(expected[i].rate);
    });
  });
});
