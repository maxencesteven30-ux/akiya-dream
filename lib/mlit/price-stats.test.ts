import { describe, expect, it } from "vitest";
import { computeAveragePricePerSqm, recentQuarters } from "@/lib/mlit/price-stats";
import type { MlitTransaction } from "@/lib/mlit/types";

function makeTransaction(overrides: Partial<MlitTransaction>): MlitTransaction {
  return {
    municipalityCode: "46201",
    prefecture: "鹿児島県",
    municipality: "鹿児島市",
    districtName: "",
    tradePriceJpy: 10_000_000,
    areaM2: null,
    totalFloorAreaM2: null,
    buildingYear: null,
    structure: null,
    use: null,
    landShape: null,
    cityPlanning: null,
    period: "2023年第1四半期",
    districtCode: "",
    ...overrides,
  };
}

describe("computeAveragePricePerSqm", () => {
  it("retourne null si aucune transaction n'a de surface exploitable", () => {
    expect(computeAveragePricePerSqm([makeTransaction({ tradePriceJpy: 5_000_000 })])).toBeNull();
  });

  it("préfère la surface de plancher totale à la surface de terrain", () => {
    const result = computeAveragePricePerSqm([
      makeTransaction({ tradePriceJpy: 10_000_000, totalFloorAreaM2: 100, areaM2: 200 }),
    ]);
    expect(result).toEqual({ averagePricePerSqmJpy: 100_000, sampleSize: 1 });
  });

  it("utilise la surface de terrain si la surface de plancher est absente", () => {
    const result = computeAveragePricePerSqm([
      makeTransaction({ tradePriceJpy: 4_000_000, totalFloorAreaM2: null, areaM2: 200 }),
    ]);
    expect(result).toEqual({ averagePricePerSqmJpy: 20_000, sampleSize: 1 });
  });

  it("exclut une transaction sans aucune surface, jamais comptée avec une surface devinée", () => {
    const result = computeAveragePricePerSqm([
      makeTransaction({ tradePriceJpy: 10_000_000, totalFloorAreaM2: 100 }),
      makeTransaction({ tradePriceJpy: 5_000_000, totalFloorAreaM2: null, areaM2: null }),
    ]);
    expect(result).toEqual({ averagePricePerSqmJpy: 100_000, sampleSize: 1 });
  });

  it("moyenne correctement plusieurs transactions", () => {
    const result = computeAveragePricePerSqm([
      makeTransaction({ tradePriceJpy: 10_000_000, totalFloorAreaM2: 100 }), // 100 000/m2
      makeTransaction({ tradePriceJpy: 20_000_000, totalFloorAreaM2: 100 }), // 200 000/m2
    ]);
    expect(result).toEqual({ averagePricePerSqmJpy: 150_000, sampleSize: 2 });
  });
});

describe("recentQuarters", () => {
  it("part de 2 trimestres avant le trimestre courant et recule ensuite", () => {
    // 15 septembre 2026 -> T3 2026 -> 2 trimestres avant = T1 2026
    const result = recentQuarters(new Date(2026, 8, 15), 4);
    expect(result).toEqual([
      { year: 2026, quarter: 1 },
      { year: 2025, quarter: 4 },
      { year: 2025, quarter: 3 },
      { year: 2025, quarter: 2 },
    ]);
  });

  it("franchit correctement le changement d'année", () => {
    // 15 janvier 2026 -> T1 2026 -> 2 trimestres avant = T3 2025
    const result = recentQuarters(new Date(2026, 0, 15), 2);
    expect(result).toEqual([
      { year: 2025, quarter: 3 },
      { year: 2025, quarter: 2 },
    ]);
  });

  it("respecte le nombre de trimestres demandé", () => {
    expect(recentQuarters(new Date(2026, 8, 15), 1)).toHaveLength(1);
    expect(recentQuarters(new Date(2026, 8, 15), 6)).toHaveLength(6);
  });
});
