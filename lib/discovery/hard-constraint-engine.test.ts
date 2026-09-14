import { describe, expect, it } from "vitest";
import { evaluateHardConstraints } from "@/lib/discovery/hard-constraint-engine";
import { createEmptySearchProfile, type HardConstraints } from "@/lib/discovery/search-profile";
import { createEmptyPropertyListing, type PropertyListing } from "@/lib/discovery/property-listing";

function emptyConstraints(): HardConstraints {
  return createEmptySearchProfile().hardConstraints;
}

function listing(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return { ...createEmptyPropertyListing("1", "tomi-city", "322", "2026-09-15T00:00:00.000Z"), ...overrides };
}

function statusOf(evaluation: ReturnType<typeof evaluateHardConstraints>, criterionId: string) {
  return evaluation.checks.find((c) => c.criterionId === criterionId)?.status;
}

describe("evaluateHardConstraints — aucun critère activé", () => {
  it("verdict PASS, tous les critères NOT_APPLICABLE — jamais UNKNOWN par défaut", () => {
    const evaluation = evaluateHardConstraints(emptyConstraints(), listing());
    expect(evaluation.verdict).toBe("PASS");
    expect(evaluation.checks.every((c) => c.status === "NOT_APPLICABLE")).toBe(true);
  });
});

describe("maxBudgetJpy", () => {
  it("PASS si le prix connu est sous le budget", () => {
    const constraints = { ...emptyConstraints(), maxBudgetJpy: 10_000_000 };
    const evaluation = evaluateHardConstraints(constraints, listing({ priceJpy: 8_000_000 }));
    expect(statusOf(evaluation, "maxBudgetJpy")).toBe("PASS");
  });

  it("FAIL si le prix connu dépasse le budget", () => {
    const constraints = { ...emptyConstraints(), maxBudgetJpy: 10_000_000 };
    const evaluation = evaluateHardConstraints(constraints, listing({ priceJpy: 12_000_000 }));
    expect(statusOf(evaluation, "maxBudgetJpy")).toBe("FAIL");
    expect(evaluation.verdict).toBe("FAIL");
  });

  it("UNKNOWN si le prix de l'annonce est inconnu, jamais PASS par défaut", () => {
    const constraints = { ...emptyConstraints(), maxBudgetJpy: 10_000_000 };
    const evaluation = evaluateHardConstraints(constraints, listing({ priceJpy: null }));
    expect(statusOf(evaluation, "maxBudgetJpy")).toBe("UNKNOWN");
    expect(evaluation.verdict).toBe("UNKNOWN");
  });
});

describe("minBuildingAreaM2", () => {
  it("PASS si la surface connue atteint le minimum", () => {
    const constraints = { ...emptyConstraints(), minBuildingAreaM2: 80 };
    const evaluation = evaluateHardConstraints(constraints, listing({ buildingAreaM2: 90 }));
    expect(statusOf(evaluation, "minBuildingAreaM2")).toBe("PASS");
  });

  it("FAIL si la surface connue est sous le minimum", () => {
    const constraints = { ...emptyConstraints(), minBuildingAreaM2: 80 };
    const evaluation = evaluateHardConstraints(constraints, listing({ buildingAreaM2: 60 }));
    expect(statusOf(evaluation, "minBuildingAreaM2")).toBe("FAIL");
  });

  it("UNKNOWN si la surface est inconnue", () => {
    const constraints = { ...emptyConstraints(), minBuildingAreaM2: 80 };
    const evaluation = evaluateHardConstraints(constraints, listing({ buildingAreaM2: null }));
    expect(statusOf(evaluation, "minBuildingAreaM2")).toBe("UNKNOWN");
  });
});

describe("minBedrooms — toujours UNKNOWN quand activé", () => {
  it("UNKNOWN dès que minBedrooms est renseigné, quel que soit roomCount", () => {
    const constraints = { ...emptyConstraints(), minBedrooms: 2 };
    const evaluation = evaluateHardConstraints(constraints, listing({ roomCount: 5 }));
    expect(statusOf(evaluation, "minBedrooms")).toBe("UNKNOWN");
  });

  it("NOT_APPLICABLE si minBedrooms n'est pas renseigné", () => {
    const evaluation = evaluateHardConstraints(emptyConstraints(), listing({ roomCount: 5 }));
    expect(statusOf(evaluation, "minBedrooms")).toBe("NOT_APPLICABLE");
  });
});

describe("excludedPrefectures", () => {
  it("NOT_APPLICABLE si la liste est vide (aucune exclusion demandée)", () => {
    const evaluation = evaluateHardConstraints(emptyConstraints(), listing({ prefecture: "長野県" }));
    expect(statusOf(evaluation, "excludedPrefectures")).toBe("NOT_APPLICABLE");
  });

  it("FAIL si la préfecture connue est dans la liste d'exclusion", () => {
    const constraints = { ...emptyConstraints(), excludedPrefectures: ["長野県"] };
    const evaluation = evaluateHardConstraints(constraints, listing({ prefecture: "長野県" }));
    expect(statusOf(evaluation, "excludedPrefectures")).toBe("FAIL");
  });

  it("PASS si la préfecture connue n'est pas exclue", () => {
    const constraints = { ...emptyConstraints(), excludedPrefectures: ["長野県"] };
    const evaluation = evaluateHardConstraints(constraints, listing({ prefecture: "岡山県" }));
    expect(statusOf(evaluation, "excludedPrefectures")).toBe("PASS");
  });

  it("UNKNOWN si la préfecture de l'annonce est inconnue", () => {
    const constraints = { ...emptyConstraints(), excludedPrefectures: ["長野県"] };
    const evaluation = evaluateHardConstraints(constraints, listing({ prefecture: null }));
    expect(statusOf(evaluation, "excludedPrefectures")).toBe("UNKNOWN");
  });
});

describe("requiresKnownRebuildability", () => {
  it("NOT_APPLICABLE si l'utilisateur n'a pas activé l'exigence", () => {
    const evaluation = evaluateHardConstraints(emptyConstraints(), listing({ rebuildability: null }));
    expect(statusOf(evaluation, "requiresKnownRebuildability")).toBe("NOT_APPLICABLE");
  });

  it("FAIL si activé mais le statut de l'annonce est encore inconnu", () => {
    const constraints = { ...emptyConstraints(), requiresKnownRebuildability: true };
    const evaluation = evaluateHardConstraints(constraints, listing({ rebuildability: null }));
    expect(statusOf(evaluation, "requiresKnownRebuildability")).toBe("FAIL");
  });

  it("PASS si activé et le statut est confirmé 'verifie'", () => {
    const constraints = { ...emptyConstraints(), requiresKnownRebuildability: true };
    const evaluation = evaluateHardConstraints(constraints, listing({ rebuildability: "verifie" }));
    expect(statusOf(evaluation, "requiresKnownRebuildability")).toBe("PASS");
  });

  it("PASS si activé et le statut est confirmé 'probleme' (connu, même défavorable)", () => {
    const constraints = { ...emptyConstraints(), requiresKnownRebuildability: true };
    const evaluation = evaluateHardConstraints(constraints, listing({ rebuildability: "probleme" }));
    expect(statusOf(evaluation, "requiresKnownRebuildability")).toBe("PASS");
  });

  it("false explicite reste NOT_APPLICABLE, distinct de null", () => {
    const constraints = { ...emptyConstraints(), requiresKnownRebuildability: false };
    const evaluation = evaluateHardConstraints(constraints, listing({ rebuildability: null }));
    expect(statusOf(evaluation, "requiresKnownRebuildability")).toBe("NOT_APPLICABLE");
  });
});

describe("verdict global", () => {
  it("FAIL prime sur UNKNOWN quand les deux sont présents", () => {
    const constraints: HardConstraints = {
      ...emptyConstraints(),
      maxBudgetJpy: 10_000_000,
      minBuildingAreaM2: 80,
    };
    const evaluation = evaluateHardConstraints(
      constraints,
      listing({ priceJpy: 12_000_000, buildingAreaM2: null }),
    );
    expect(evaluation.verdict).toBe("FAIL");
  });

  it("PASS uniquement si tous les critères actifs sont PASS ou NOT_APPLICABLE", () => {
    const constraints: HardConstraints = {
      ...emptyConstraints(),
      maxBudgetJpy: 10_000_000,
      excludedPrefectures: ["長野県"],
    };
    const evaluation = evaluateHardConstraints(
      constraints,
      listing({ priceJpy: 8_000_000, prefecture: "岡山県" }),
    );
    expect(evaluation.verdict).toBe("PASS");
  });
});
