import { describe, expect, it } from "vitest";
import { scoreRegion } from "@/lib/scoring";
import type { Region, RegionAttributes } from "@/lib/types";

const REGION_GIFU: Region = {
  prefecture: "Gifu",
  medianPriceJpy: 4_500_000,
  medianAgeYears: 41,
  pre1981Percent: 41,
  subsidyMaxJpy: 0,
  recommendationLevel: "B",
};

const ATTRS_GIFU: RegionAttributes = {
  hasCoastline: false,
  shinkansenStationCount: 1,
  forestAreaPercent: 81.12,
  avgAnnualSnowfallCm: 47,
};

const REGION_MIYAZAKI: Region = {
  prefecture: "Miyazaki",
  medianPriceJpy: 5_000_000,
  medianAgeYears: 37,
  pre1981Percent: 32,
  subsidyMaxJpy: 0,
  recommendationLevel: "C",
};

const ATTRS_MIYAZAKI: RegionAttributes = {
  hasCoastline: true,
  shinkansenStationCount: 0,
  forestAreaPercent: 76.25,
  avgAnnualSnowfallCm: 0,
};

const NO_PREFERENCE = {
  coastal: "peu_importe" as const,
  shinkansen: "peu_importe" as const,
  rural: "peu_importe" as const,
  snow: "peu_importe" as const,
  budget: null,
};

describe("scoreRegion", () => {
  it("ne retourne aucun critère si toutes les préférences sont 'peu importe' et sans budget", () => {
    const result = scoreRegion(REGION_GIFU, ATTRS_GIFU, NO_PREFERENCE);
    expect(result.criteria).toHaveLength(0);
    expect(result.totalPoints).toBe(0);
    expect(result.maxPoints).toBe(0);
  });

  it("n'inclut que les critères explicitement demandés", () => {
    const result = scoreRegion(REGION_GIFU, ATTRS_GIFU, {
      ...NO_PREFERENCE,
      coastal: "importe",
    });
    expect(result.criteria.map((c) => c.key)).toEqual(["coastal"]);
  });

  it("attribue 0 point de façade maritime à une préfecture enclavée", () => {
    const result = scoreRegion(REGION_GIFU, ATTRS_GIFU, {
      ...NO_PREFERENCE,
      coastal: "importe",
    });
    const coastal = result.criteria.find((c) => c.key === "coastal")!;
    expect(coastal.points).toBe(0);
    expect(coastal.maxPoints).toBe(20);
  });

  it("attribue le maximum de points de façade maritime à une préfecture côtière", () => {
    const result = scoreRegion(REGION_MIYAZAKI, ATTRS_MIYAZAKI, {
      ...NO_PREFERENCE,
      coastal: "importe",
    });
    const coastal = result.criteria.find((c) => c.key === "coastal")!;
    expect(coastal.points).toBe(20);
  });

  it("Gifu (81,12% boisé, le maximum observé) obtient le score rural maximal", () => {
    const result = scoreRegion(REGION_GIFU, ATTRS_GIFU, {
      ...NO_PREFERENCE,
      rural: "importe",
    });
    const rural = result.criteria.find((c) => c.key === "rural")!;
    expect(rural.points).toBe(15);
  });

  it("Miyazaki (0 gare Shinkansen) obtient 0 point si l'accès Shinkansen est demandé", () => {
    const result = scoreRegion(REGION_MIYAZAKI, ATTRS_MIYAZAKI, {
      ...NO_PREFERENCE,
      shinkansen: "importe",
    });
    const shinkansen = result.criteria.find((c) => c.key === "shinkansen")!;
    expect(shinkansen.points).toBe(0);
  });

  it("Miyazaki (0 cm de neige, le minimum observé) obtient le score maximal si on veut éviter la neige", () => {
    const result = scoreRegion(REGION_MIYAZAKI, ATTRS_MIYAZAKI, {
      ...NO_PREFERENCE,
      snow: "eviter",
    });
    const snow = result.criteria.find((c) => c.key === "snow")!;
    expect(snow.points).toBe(15);
  });

  it("Gifu (47 cm de neige) obtient 0 point si on recherche la neige abondante (proche du minimum observé)", () => {
    const result = scoreRegion(REGION_GIFU, ATTRS_GIFU, {
      ...NO_PREFERENCE,
      snow: "recherche",
    });
    const snow = result.criteria.find((c) => c.key === "snow")!;
    expect(snow.points).toBeLessThan(8); // proche de 0, loin du max observé (669cm)
  });

  it("renvoie 0 point (pas d'invention) pour un attribut inconnu (région composite)", () => {
    const unknownAttrs: RegionAttributes = {
      hasCoastline: null,
      shinkansenStationCount: null,
      forestAreaPercent: null,
      avgAnnualSnowfallCm: null,
    };
    const result = scoreRegion(REGION_GIFU, unknownAttrs, {
      coastal: "importe",
      shinkansen: "importe",
      rural: "importe",
      snow: "eviter",
      budget: null,
    });
    expect(result.criteria.every((c) => c.points === 0)).toBe(true);
    expect(result.criteria.every((c) => c.justification.includes("indisponible"))).toBe(true);
  });

  it("score le budget comme confortable quand le disponible dépasse largement le prix médian", () => {
    const result = scoreRegion(REGION_GIFU, ATTRS_GIFU, {
      ...NO_PREFERENCE,
      budget: { capitalDisponibleEur: 100_000, reserveSecuriteEur: 10_000 },
    });
    const budget = result.criteria.find((c) => c.key === "budget")!;
    expect(budget.points).toBe(30);
  });

  it("score le budget à 0 quand le disponible est inférieur au prix médian", () => {
    const result = scoreRegion(REGION_GIFU, ATTRS_GIFU, {
      ...NO_PREFERENCE,
      budget: { capitalDisponibleEur: 5_000, reserveSecuriteEur: 1_000 },
    });
    const budget = result.criteria.find((c) => c.key === "budget")!;
    expect(budget.points).toBe(0);
  });

  it("le total et le maximum s'additionnent correctement sur plusieurs critères", () => {
    const result = scoreRegion(REGION_MIYAZAKI, ATTRS_MIYAZAKI, {
      coastal: "importe",
      shinkansen: "peu_importe",
      rural: "peu_importe",
      snow: "eviter",
      budget: null,
    });
    expect(result.maxPoints).toBe(20 + 15); // coastal + snow
    expect(result.totalPoints).toBe(20 + 15); // les deux au maximum pour Miyazaki
    expect(result.criteriaEvaluated).toBe(2);
    expect(result.criteriaAvailable).toBe(5);
  });
});
