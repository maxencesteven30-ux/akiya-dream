import { describe, expect, it } from "vitest";
import { computeAnnualTaxes, computeCostProjection } from "@/lib/taxes";
import { EUR_JPY_RATE } from "@/lib/calculations";

describe("computeAnnualTaxes", () => {
  it("applique les taux nationaux standards (1,4% / 0,3%) à la valeur fiscale", () => {
    const taxes = computeAnnualTaxes(1_500_000);
    expect(taxes.propertyTaxJpy).toBeCloseTo(21_000, 6);
    expect(taxes.cityPlanningTaxJpy).toBeCloseTo(4_500, 6);
    expect(taxes.totalJpy).toBeCloseTo(25_500, 6);
  });

  it("retourne 0 pour une valeur fiscale nulle (jamais NaN)", () => {
    const taxes = computeAnnualTaxes(0);
    expect(taxes.totalJpy).toBe(0);
    expect(Number.isNaN(taxes.totalJpy)).toBe(false);
  });

  it("est déterministe", () => {
    const a = computeAnnualTaxes(2_000_000);
    const b = computeAnnualTaxes(2_000_000);
    expect(a).toEqual(b);
  });
});

describe("computeCostProjection", () => {
  it("calcule le coût cumulé exact aux jalons demandés", () => {
    const points = computeCostProjection(6_000_000, 200_000, [1, 5, 10]);
    expect(points).toHaveLength(3);
    expect(points[0]).toMatchObject({ year: 1, cumulativeCostJpy: 6_200_000 });
    expect(points[1]).toMatchObject({ year: 5, cumulativeCostJpy: 7_000_000 });
    expect(points[2]).toMatchObject({ year: 10, cumulativeCostJpy: 8_000_000 });
  });

  it("convertit correctement en EUR avec le taux courant", () => {
    const points = computeCostProjection(6_000_000, 0, [1]);
    expect(points[0].cumulativeCostEur).toBeCloseTo(6_000_000 / EUR_JPY_RATE, 6);
  });

  it("gère un coût annuel nul sans diviser par zéro", () => {
    const points = computeCostProjection(1_000_000, 0, [1, 5, 10]);
    for (const p of points) {
      expect(p.cumulativeCostJpy).toBe(1_000_000);
      expect(Number.isNaN(p.cumulativeCostJpy)).toBe(false);
    }
  });

  it("utilise les jalons par défaut [1, 5, 10] si non précisés", () => {
    const points = computeCostProjection(1_000_000, 100_000);
    expect(points.map((p) => p.year)).toEqual([1, 5, 10]);
  });
});
