import { describe, expect, it } from "vitest";
import { computePriceAnomaly } from "@/lib/price-anomaly";
import type { MarketComparison } from "@/lib/comparable-transactions";

function comparison(overrides: Partial<MarketComparison> = {}): MarketComparison {
  return {
    totalTransactions: 3,
    comparableCount: 3,
    partiallyComparableCount: 0,
    periodsCovered: ["2024年第1四半期"],
    oldestPeriod: "2024年第1四半期",
    newestPeriod: "2024年第1四半期",
    priceDispersionJpy: { minJpy: 4_000_000, maxJpy: 6_000_000 },
    medianPriceJpy: 5_000_000,
    missingDataCount: 0,
    confidence: "HIGH",
    limits: [],
    ...overrides,
  };
}

describe("computePriceAnomaly", () => {
  it("LOWER_THAN_AVAILABLE_COMPARABLES : prix sous la fourchette, jamais présenté comme une bonne affaire", () => {
    const result = computePriceAnomaly(2_000_000, "AVAILABLE", comparison());
    expect(result.status).toBe("LOWER_THAN_AVAILABLE_COMPARABLES");
    expect(result.message).toMatch(/bonne affaire/i);
  });

  it("WITHIN_AVAILABLE_RANGE : prix dans la fourchette", () => {
    const result = computePriceAnomaly(5_000_000, "AVAILABLE", comparison());
    expect(result.status).toBe("WITHIN_AVAILABLE_RANGE");
  });

  it("HIGHER_THAN_AVAILABLE_COMPARABLES : prix au-dessus de la fourchette", () => {
    const result = computePriceAnomaly(9_000_000, "AVAILABLE", comparison());
    expect(result.status).toBe("HIGHER_THAN_AVAILABLE_COMPARABLES");
  });

  it("INSUFFICIENT_DATA : aucun comparable, jamais une conclusion forcée", () => {
    const result = computePriceAnomaly(5_000_000, "AVAILABLE", comparison({ comparableCount: 0, priceDispersionJpy: null }));
    expect(result.status).toBe("INSUFFICIENT_DATA");
  });

  it("DATA_UNAVAILABLE : fournisseur indisponible (clé absente)", () => {
    const result = computePriceAnomaly(5_000_000, "UNAVAILABLE", null);
    expect(result.status).toBe("DATA_UNAVAILABLE");
  });

  it("DATA_UNAVAILABLE : erreur technique", () => {
    const result = computePriceAnomaly(5_000_000, "ERROR", null);
    expect(result.status).toBe("DATA_UNAVAILABLE");
  });

  it("DATA_UNAVAILABLE : localisation insuffisante", () => {
    const result = computePriceAnomaly(5_000_000, "INSUFFICIENT_LOCATION", null);
    expect(result.status).toBe("DATA_UNAVAILABLE");
  });

  it("les bornes exactes de la fourchette comptent comme WITHIN, pas comme un dépassement", () => {
    expect(computePriceAnomaly(4_000_000, "AVAILABLE", comparison()).status).toBe("WITHIN_AVAILABLE_RANGE");
    expect(computePriceAnomaly(6_000_000, "AVAILABLE", comparison()).status).toBe("WITHIN_AVAILABLE_RANGE");
  });
});
