import { describe, expect, it } from "vitest";
import { createEmptySearchProfile, deriveSearchProfileFromProject } from "@/lib/discovery/search-profile";
import type { SimulatorState } from "@/lib/types";

// État minimal — seuls les champs lus par deriveSearchProfileFromProject
// sont significatifs ; le reste est un état "vide" plausible.
function baseState(overrides: Partial<SimulatorState> = {}): SimulatorState {
  return {
    profile: null,
    housePriceJpy: 5_000_000,
    prefecture: null,
    renovationLevel: null,
    capitalDisponibleEur: null,
    reserveSecuriteEur: null,
    realListing: null,
    accompanimentLevel: "autonome",
    needsTranslation: false,
    hiddenCosts: {
      surveyBoundary: false,
      pestTreatment: false,
      septicTankService: false,
      backTaxesNegotiation: false,
    },
    snowyRegion: false,
    includeNeighborhoodAssociation: false,
    dueDiligence: {},
    history: [],
    currentProjectId: null,
    visitChecklist: {},
    realityGate: {},
    landNature: null,
    realityGateDocuments: {},
    remoteOwner: {
      residenceLocation: null,
      usageFrequency: null,
      vacancyDuration: null,
      caretaker: null,
      checkFrequency: null,
      ownershipPurpose: null,
      ownershipGoal: null,
      visaPlanConfirmed: false,
      nonResidentAdmin: {},
    },
    exitStrategy: {
      strategy: null,
      horizonYears: 10,
      resaleValueJpy: null,
      monthlyRentJpy: null,
      occupancyRatePercent: null,
      demolitionCostJpy: null,
      minpakuChecklist: {},
    },
    ...overrides,
  };
}

describe("createEmptySearchProfile", () => {
  it("tout est null/vide, jamais une valeur par défaut favorable", () => {
    const profile = createEmptySearchProfile();
    expect(profile.hardConstraints.maxBudgetJpy).toBeNull();
    expect(profile.hardConstraints.requiresKnownRebuildability).toBeNull();
    expect(profile.softPreferences.wantsGarden).toBeNull();
    expect(profile.hardConstraints.excludedPrefectures).toEqual([]);
  });

  it("liste tous les critères comme inconnus (sauf les listes vides, valides en soi)", () => {
    const profile = createEmptySearchProfile();
    expect(profile.unknownCriteria).toContain("Budget maximum");
    expect(profile.unknownCriteria).toContain("Présence d'un jardin souhaitée");
    expect(profile.unknownCriteria).toContain("Exigence d'un droit de reconstruire déjà vérifié");
  });
});

describe("deriveSearchProfileFromProject", () => {
  it("ne redemande pas le budget déjà connu du projet : réutilise computeMaxAffordablePrice", () => {
    const profile = deriveSearchProfileFromProject(
      baseState({ profile: "solo", capitalDisponibleEur: 100_000, reserveSecuriteEur: 10_000 }),
    );
    expect(profile.hardConstraints.maxBudgetJpy).not.toBeNull();
    expect(profile.hardConstraints.maxBudgetJpy).toBeGreaterThan(0);
    expect(profile.unknownCriteria).not.toContain("Budget maximum");
  });

  it("budget reste UNKNOWN si le capital n'est pas renseigné, jamais 0 ou une moyenne", () => {
    const profile = deriveSearchProfileFromProject(baseState());
    expect(profile.hardConstraints.maxBudgetJpy).toBeNull();
    expect(profile.unknownCriteria).toContain("Budget maximum");
  });

  it("réutilise la préfecture déjà choisie comme préférence souple, jamais une contrainte dure", () => {
    const profile = deriveSearchProfileFromProject(baseState({ prefecture: "Nagano" }));
    expect(profile.softPreferences.preferredPrefectures).toEqual(["Nagano"]);
    expect(profile.hardConstraints.excludedPrefectures).toEqual([]);
  });

  it("n'invente jamais une préférence jardin/rural/voiture à partir de champs qui ne l'impliquent pas", () => {
    const profile = deriveSearchProfileFromProject(
      baseState({ profile: "solo", renovationLevel: "lourd", capitalDisponibleEur: 100_000, reserveSecuriteEur: 10_000 }),
    );
    expect(profile.softPreferences.wantsGarden).toBeNull();
    expect(profile.softPreferences.ruralEnvironment).toBeNull();
    expect(profile.softPreferences.noCarRequired).toBeNull();
    expect(profile.softPreferences.renovationAcceptable).toBeNull();
  });

  it("le budget max intègre le niveau de travaux déjà choisi (même formule que le reste de l'app)", () => {
    const withoutTravaux = deriveSearchProfileFromProject(
      baseState({ profile: "solo", capitalDisponibleEur: 100_000, reserveSecuriteEur: 10_000 }),
    );
    const withTravaux = deriveSearchProfileFromProject(
      baseState({
        profile: "solo",
        capitalDisponibleEur: 100_000,
        reserveSecuriteEur: 10_000,
        renovationLevel: "lourd",
      }),
    );
    expect(withTravaux.hardConstraints.maxBudgetJpy!).toBeLessThan(withoutTravaux.hardConstraints.maxBudgetJpy!);
  });
});
