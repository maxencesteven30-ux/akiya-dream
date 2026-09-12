import { describe, expect, it } from "vitest";
import { compareProperties, getBestDeal, type PropertyComparisonInput } from "@/lib/comparison";
import type { RealListing, Region, SavedProject } from "@/lib/types";

const REGION: Region = {
  prefecture: "Fukuoka_Periph",
  medianPriceJpy: 4_000_000,
  medianAgeYears: 35,
  pre1981Percent: 30,
  subsidyMaxJpy: 0,
  recommendationLevel: "B",
};

const GOOD_LISTING: RealListing = {
  name: "Bien A",
  city: "Test",
  latitude: null,
  longitude: null,
  surfaceM2: 80,
  landM2: null,
  constructionYear: 2015,
  stationDistanceKm: null,
  condition: "good",
};

function makeProject(overrides: Partial<SavedProject> = {}): SavedProject {
  return {
    id: "p1",
    name: "Projet",
    profile: "solo",
    housePriceJpy: 3_000_000,
    renovationLevel: "leger",
    prefecture: null,
    realListing: null,
    ...overrides,
  };
}

describe("compareProperties", () => {
  it("retourne un tableau trié par note d'opportunité décroissante", () => {
    const inputs: PropertyComparisonInput[] = [
      {
        property: makeProject({
          id: "p_moyen",
          housePriceJpy: 4_500_000,
          realListing: { ...GOOD_LISTING, condition: "needs_renovation" },
        }),
        region: REGION,
        capitalDisponibleEur: null,
        reserveSecuriteEur: null,
      },
      {
        property: makeProject({
          id: "p_bon",
          housePriceJpy: 2_000_000,
          realListing: GOOD_LISTING,
        }),
        region: REGION,
        capitalDisponibleEur: null,
        reserveSecuriteEur: null,
      },
    ];

    const result = compareProperties(inputs);
    expect(result).toHaveLength(2);
    expect(result[0].propertyId).toBe("p_bon");
    expect(result[0].opportunityScore!).toBeGreaterThan(result[1].opportunityScore!);
  });

  it("place les biens sans note connue (données insuffisantes) après les biens notés", () => {
    const inputs: PropertyComparisonInput[] = [
      {
        property: makeProject({ id: "sans_note" }), // pas de région ni de realListing
        region: null,
        capitalDisponibleEur: null,
        reserveSecuriteEur: null,
      },
      {
        property: makeProject({ id: "avec_note", realListing: GOOD_LISTING }),
        region: REGION,
        capitalDisponibleEur: null,
        reserveSecuriteEur: null,
      },
    ];

    const result = compareProperties(inputs);
    expect(result[0].propertyId).toBe("avec_note");
    expect(result[1].propertyId).toBe("sans_note");
    expect(result[1].opportunityScore).toBeNull();
  });

  it("gère 0 bien sans planter", () => {
    expect(compareProperties([])).toEqual([]);
  });

  it("gère 1 seul bien", () => {
    const result = compareProperties([
      {
        property: makeProject(),
        region: null,
        capitalDisponibleEur: null,
        reserveSecuriteEur: null,
      },
    ]);
    expect(result).toHaveLength(1);
  });

  it("gère 3 biens (maximum comparable)", () => {
    const inputs: PropertyComparisonInput[] = [
      { property: makeProject({ id: "a" }), region: null, capitalDisponibleEur: null, reserveSecuriteEur: null },
      { property: makeProject({ id: "b" }), region: null, capitalDisponibleEur: null, reserveSecuriteEur: null },
      { property: makeProject({ id: "c" }), region: null, capitalDisponibleEur: null, reserveSecuriteEur: null },
    ];
    expect(compareProperties(inputs)).toHaveLength(3);
  });

  it("feasibilityVerdict est null sans capital/réserve renseignés (jamais inventé)", () => {
    const result = compareProperties([
      {
        property: makeProject(),
        region: null,
        capitalDisponibleEur: null,
        reserveSecuriteEur: null,
      },
    ]);
    expect(result[0].feasibilityVerdict).toBeNull();
  });

  it("feasibilityVerdict reflète le verdict budgétaire quand le budget est connu", () => {
    const confortable = compareProperties([
      {
        property: makeProject({ housePriceJpy: 1_000_000, renovationLevel: "leger" }),
        region: null,
        capitalDisponibleEur: 100_000,
        reserveSecuriteEur: 0,
      },
    ]);
    expect(confortable[0].feasibilityVerdict).toBe("✅ Oui");

    const insuffisant = compareProperties([
      {
        property: makeProject({ housePriceJpy: 9_000_000, renovationLevel: "lourd" }),
        region: null,
        capitalDisponibleEur: 5_000,
        reserveSecuriteEur: 0,
      },
    ]);
    expect(insuffisant[0].feasibilityVerdict).toBe("❌ Non");
  });

  it("renovationDurationMonths est déterministe selon le niveau de travaux", () => {
    const result = compareProperties([
      { property: makeProject({ renovationLevel: "leger" }), region: null, capitalDisponibleEur: null, reserveSecuriteEur: null },
      { property: makeProject({ id: "p2", renovationLevel: "lourd" }), region: null, capitalDisponibleEur: null, reserveSecuriteEur: null },
    ]);
    const leger = result.find((r) => r.propertyId === "p1")!;
    const lourd = result.find((r) => r.propertyId === "p2")!;
    expect(leger.renovationDurationMonths).toBeLessThan(lourd.renovationDurationMonths);
  });
});

describe("getBestDeal", () => {
  it("retourne le bien avec la meilleure note ET une faisabilité ✅ Oui", () => {
    const inputs: PropertyComparisonInput[] = [
      {
        property: makeProject({ id: "bon_mais_hors_budget", realListing: GOOD_LISTING, housePriceJpy: 2_000_000 }),
        region: REGION,
        capitalDisponibleEur: 1_000,
        reserveSecuriteEur: 0,
      },
      {
        property: makeProject({
          id: "moyen_mais_finançable",
          realListing: { ...GOOD_LISTING, condition: "needs_renovation" },
          housePriceJpy: 2_000_000,
        }),
        region: REGION,
        capitalDisponibleEur: 100_000,
        reserveSecuriteEur: 0,
      },
    ];

    const comparisons = compareProperties(inputs);
    const best = getBestDeal(comparisons);
    expect(best).not.toBeNull();
    expect(best!.propertyId).toBe("moyen_mais_finançable");
  });

  it("retourne null si aucun bien n'est à la fois noté et finançable", () => {
    const comparisons = compareProperties([
      {
        property: makeProject(),
        region: null,
        capitalDisponibleEur: null,
        reserveSecuriteEur: null,
      },
    ]);
    expect(getBestDeal(comparisons)).toBeNull();
  });

  it("gère un tableau vide", () => {
    expect(getBestDeal([])).toBeNull();
  });
});
