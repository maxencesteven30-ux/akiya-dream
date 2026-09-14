import { describe, expect, it } from "vitest";
import { runDiscoveryEngine } from "@/lib/discovery/discovery-orchestrator";
import { createEmptySearchProfile, type SearchProfile } from "@/lib/discovery/search-profile";
import { createEmptyPropertyListing, type PropertyListing } from "@/lib/discovery/property-listing";

function profile(overrides: Partial<SearchProfile["hardConstraints"]> = {}): SearchProfile {
  const empty = createEmptySearchProfile();
  return { ...empty, hardConstraints: { ...empty.hardConstraints, ...overrides } };
}

function listing(id: string, overrides: Partial<PropertyListing> = {}): PropertyListing {
  return { ...createEmptyPropertyListing(id, "tomi-city", id, "2026-09-15T00:00:00.000Z"), ...overrides };
}

describe("runDiscoveryEngine — pool vide", () => {
  it("ne lève jamais d'exception, retourne trois listes vides", () => {
    expect(() => runDiscoveryEngine(createEmptySearchProfile(), [])).not.toThrow();
    const result = runDiscoveryEngine(createEmptySearchProfile(), []);
    expect(result).toEqual({ eligible: [], needsReview: [], excluded: [] });
  });
});

describe("runDiscoveryEngine — répartition stricte en trois listes", () => {
  it("un verdict PASS va dans eligible, jamais ailleurs", () => {
    const result = runDiscoveryEngine(
      profile({ maxBudgetJpy: 10_000_000 }),
      [listing("1", { priceJpy: 5_000_000 })],
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.needsReview).toHaveLength(0);
    expect(result.excluded).toHaveLength(0);
  });

  it("un verdict UNKNOWN va dans needsReview, jamais fusionné avec eligible ou excluded", () => {
    const result = runDiscoveryEngine(
      profile({ maxBudgetJpy: 10_000_000 }),
      [listing("1", { priceJpy: null })],
    );
    expect(result.eligible).toHaveLength(0);
    expect(result.needsReview).toHaveLength(1);
    expect(result.excluded).toHaveLength(0);
  });

  it("un verdict FAIL va dans excluded", () => {
    const result = runDiscoveryEngine(
      profile({ maxBudgetJpy: 10_000_000 }),
      [listing("1", { priceJpy: 20_000_000 })],
    );
    expect(result.eligible).toHaveLength(0);
    expect(result.needsReview).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });

  it("conserve le nombre total de candidats à travers les trois listes", () => {
    const result = runDiscoveryEngine(profile({ maxBudgetJpy: 10_000_000 }), [
      listing("pass", { priceJpy: 5_000_000 }),
      listing("unknown", { priceJpy: null }),
      listing("fail", { priceJpy: 20_000_000 }),
    ]);
    const total = result.eligible.length + result.needsReview.length + result.excluded.length;
    expect(total).toBe(3);
  });
});

describe("runDiscoveryEngine — classement interne par préférences douces", () => {
  it("trie eligible par score décroissant sans changer sa composition", () => {
    const empty = createEmptySearchProfile();
    const searchProfile: SearchProfile = {
      ...empty,
      hardConstraints: { ...empty.hardConstraints, maxBudgetJpy: 10_000_000 },
      softPreferences: { ...empty.softPreferences, wantsGarden: true },
    };
    const result = runDiscoveryEngine(searchProfile, [
      listing("no-garden", { priceJpy: 5_000_000, hasGarden: false }),
      listing("garden", { priceJpy: 5_000_000, hasGarden: true }),
    ]);

    expect(result.eligible).toHaveLength(2);
    expect(result.eligible[0].listing.id).toBe("garden");
  });
});

describe("runDiscoveryEngine — chaque item porte son évaluation complète", () => {
  it("expose hardConstraintEvaluation et softPreferenceScore par candidat, jamais recalculés séparément", () => {
    const result = runDiscoveryEngine(
      profile({ maxBudgetJpy: 10_000_000 }),
      [listing("1", { priceJpy: 5_000_000 })],
    );
    const item = result.eligible[0];
    expect(item.hardConstraintEvaluation.verdict).toBe("PASS");
    expect(item.softPreferenceScore.listing.id).toBe("1");
  });
});
