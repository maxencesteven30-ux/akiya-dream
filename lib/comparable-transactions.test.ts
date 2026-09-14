import { describe, expect, it } from "vitest";
import { computeComparability, computeMarketComparison, type ComparableSubject } from "@/lib/comparable-transactions";
import type { MlitTransaction } from "@/lib/mlit/types";

function transaction(overrides: Partial<MlitTransaction> = {}): MlitTransaction {
  return {
    municipalityCode: "20201",
    prefecture: "長野県",
    municipality: "長野市",
    districtName: "Test",
    tradePriceJpy: 5_000_000,
    areaM2: 200,
    totalFloorAreaM2: 90,
    buildingYear: 2000,
    structure: null,
    use: "住宅",
    landShape: null,
    cityPlanning: null,
    period: "2024年第1四半期",
    districtCode: "TEST",
    ...overrides,
  };
}

const SUBJECT: ComparableSubject = { municipalityCode: "20201", surfaceM2: 90, constructionYear: 2000 };

describe("computeComparability", () => {
  it("comparable : même municipalité, surface et ère proches", () => {
    const result = computeComparability(SUBJECT, transaction());
    expect(result.level).toBe("comparable");
  });

  it("non_comparable : municipalité différente, quel que soit le reste", () => {
    const result = computeComparability(SUBJECT, transaction({ municipalityCode: "13102" }));
    expect(result.level).toBe("non_comparable");
    expect(result.reasons[0]).toMatch(/municipalité/i);
  });

  it("non_comparable : usage commercial connu, même si surface/ère proches", () => {
    const result = computeComparability(SUBJECT, transaction({ use: "商業" }));
    expect(result.level).toBe("non_comparable");
    expect(result.reasons[0]).toMatch(/non résidentiel/i);
  });

  it("partiellement_comparable : surface proche mais ère différente", () => {
    const result = computeComparability(SUBJECT, transaction({ buildingYear: 1975 }));
    expect(result.level).toBe("partiellement_comparable");
  });

  it("partiellement_comparable : ère identique mais surface très différente", () => {
    const result = computeComparability(SUBJECT, transaction({ totalFloorAreaM2: 400 }));
    expect(result.level).toBe("partiellement_comparable");
  });

  it("non_comparable : ni surface ni ère proches", () => {
    const result = computeComparability(SUBJECT, transaction({ totalFloorAreaM2: 400, buildingYear: 1975 }));
    expect(result.level).toBe("non_comparable");
  });

  it("insuffisant : le bien à évaluer n'a pas de surface/année renseignée", () => {
    const result = computeComparability(
      { municipalityCode: "20201", surfaceM2: null, constructionYear: null },
      transaction(),
    );
    expect(result.level).toBe("insuffisant");
  });

  it("insuffisant : la transaction elle-même est incomplète", () => {
    const result = computeComparability(SUBJECT, transaction({ totalFloorAreaM2: null, buildingYear: null }));
    expect(result.level).toBe("insuffisant");
  });
});

describe("computeMarketComparison", () => {
  it("jamais un prix affirmé : renvoie une dispersion, pas une valeur unique", () => {
    const result = computeMarketComparison(SUBJECT, [
      transaction({ districtCode: "A", tradePriceJpy: 4_800_000 }),
      transaction({ districtCode: "B", tradePriceJpy: 5_200_000 }),
      transaction({ districtCode: "C", tradePriceJpy: 5_000_000 }),
    ]);
    expect(result.comparableCount).toBe(3);
    expect(result.priceDispersionJpy).toEqual({ minJpy: 4_800_000, maxJpy: 5_200_000 });
    expect(result.confidence).toBe("HIGH");
  });

  it("confiance LOW et limite explicite quand aucune transaction n'est comparable", () => {
    const result = computeMarketComparison(SUBJECT, [transaction({ municipalityCode: "13102" })]);
    expect(result.comparableCount).toBe(0);
    expect(result.priceDispersionJpy).toBeNull();
    expect(result.confidence).toBe("LOW");
    expect(result.limits.some((l) => /aucune transaction réellement comparable/i.test(l))).toBe(true);
  });

  it("liste vide → limite explicite, jamais un silence", () => {
    const result = computeMarketComparison(SUBJECT, []);
    expect(result.limits.some((l) => /aucune transaction disponible/i.test(l))).toBe(true);
  });

  it("compte les transactions écartées faute de données", () => {
    const result = computeMarketComparison(SUBJECT, [transaction({ totalFloorAreaM2: null, buildingYear: null })]);
    expect(result.missingDataCount).toBe(1);
  });

  it("confiance MEDIUM entre 1 et 2 comparables", () => {
    const result = computeMarketComparison(SUBJECT, [transaction({ districtCode: "A" })]);
    expect(result.confidence).toBe("MEDIUM");
  });

  it("AD.1.4 — distingue explicitement 0, 1, 2 et 3 comparables, jamais assimilés à 'un marché'", () => {
    const zero = computeMarketComparison(SUBJECT, []);
    const one = computeMarketComparison(SUBJECT, [transaction({ districtCode: "A" })]);
    const two = computeMarketComparison(SUBJECT, [
      transaction({ districtCode: "A" }),
      transaction({ districtCode: "B" }),
    ]);
    const three = computeMarketComparison(SUBJECT, [
      transaction({ districtCode: "A" }),
      transaction({ districtCode: "B" }),
      transaction({ districtCode: "C" }),
    ]);
    expect([zero.comparableCount, one.comparableCount, two.comparableCount, three.comparableCount]).toEqual([
      0, 1, 2, 3,
    ]);
    expect([zero.confidence, one.confidence, two.confidence, three.confidence]).toEqual([
      "LOW",
      "MEDIUM",
      "MEDIUM",
      "HIGH",
    ]);
  });

  it("AD.1.5 — médiane calculée seulement à partir de 3 comparables (échantillon jugé suffisant)", () => {
    const twoComparables = computeMarketComparison(SUBJECT, [
      transaction({ districtCode: "A", tradePriceJpy: 4_000_000 }),
      transaction({ districtCode: "B", tradePriceJpy: 6_000_000 }),
    ]);
    expect(twoComparables.medianPriceJpy).toBeNull();

    const threeComparables = computeMarketComparison(SUBJECT, [
      transaction({ districtCode: "A", tradePriceJpy: 4_000_000 }),
      transaction({ districtCode: "B", tradePriceJpy: 5_000_000 }),
      transaction({ districtCode: "C", tradePriceJpy: 9_000_000 }),
    ]);
    expect(threeComparables.medianPriceJpy).toBe(5_000_000);
  });

  it("AD.1.6 — expose la transaction la plus ancienne et la plus récente, jamais masquées", () => {
    const result = computeMarketComparison(SUBJECT, [
      transaction({ districtCode: "A", period: "2023年第2四半期" }),
      transaction({ districtCode: "B", period: "2006年第1四半期" }),
      transaction({ districtCode: "C", period: "2024年第4四半期" }),
    ]);
    expect(result.oldestPeriod).toBe("2006年第1四半期");
    expect(result.newestPeriod).toBe("2024年第4四半期");
  });

  it("oldestPeriod/newestPeriod restent null quand aucune période n'est parsable", () => {
    const result = computeMarketComparison(SUBJECT, [transaction({ period: "format inattendu" })]);
    expect(result.oldestPeriod).toBeNull();
    expect(result.newestPeriod).toBeNull();
  });
});
