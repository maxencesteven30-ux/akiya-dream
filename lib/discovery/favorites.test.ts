import { describe, expect, it } from "vitest";
import {
  createFavoriteSnapshot,
  isFavorite,
  removeFavoriteById,
  toggleFavorite,
} from "@/lib/discovery/favorites";
import { createEmptyPropertyListing } from "@/lib/discovery/property-listing";
import { evaluateHardConstraints } from "@/lib/discovery/hard-constraint-engine";
import { scoreSoftPreferences } from "@/lib/discovery/soft-preference-ranking";
import { createEmptySearchProfile } from "@/lib/discovery/search-profile";
import type { DiscoveryResultItem } from "@/lib/discovery/discovery-orchestrator";

function buildItem(overrides: object = {}): DiscoveryResultItem {
  const profile = {
    ...createEmptySearchProfile(),
    hardConstraints: { ...createEmptySearchProfile().hardConstraints, maxBudgetJpy: 5_000_000 },
    softPreferences: { ...createEmptySearchProfile().softPreferences, wantsGarden: true },
  };
  const listing = {
    ...createEmptyPropertyListing("id1", "test-source", "src1"),
    priceJpy: 3_000_000,
    hasGarden: true,
    title: "Maison test",
    sourceUrl: "https://example.com/listing/1",
    ...overrides,
  };
  return {
    listing,
    hardConstraintEvaluation: evaluateHardConstraints(profile.hardConstraints, listing),
    softPreferenceScore: scoreSoftPreferences(profile.softPreferences, listing),
  };
}

describe("createFavoriteSnapshot", () => {
  it("fige exactement le verdict et le score déjà calculés, sans recalcul", () => {
    const item = buildItem();
    const snapshot = createFavoriteSnapshot(item, "2026-09-15T00:00:00.000Z");
    expect(snapshot).toEqual({
      listingId: "id1",
      source: "test-source",
      sourceListingId: "src1",
      sourceUrl: "https://example.com/listing/1",
      title: "Maison test",
      savedAt: "2026-09-15T00:00:00.000Z",
      availabilityStatusAtSave: "UNKNOWN",
      hardConstraintVerdictAtSave: item.hardConstraintEvaluation.verdict,
      softPreferenceScoreAtSave: item.softPreferenceScore.score,
      softPreferenceActiveCriteriaCountAtSave: item.softPreferenceScore.activeCriteriaCount,
    });
  });
});

describe("isFavorite / toggleFavorite", () => {
  it("ajoute un favori absent", () => {
    const item = buildItem();
    const favorites = toggleFavorite([], item);
    expect(favorites).toHaveLength(1);
    expect(isFavorite(favorites, "id1")).toBe(true);
  });

  it("retire un favori déjà présent (toggle)", () => {
    const item = buildItem();
    const withFavorite = toggleFavorite([], item);
    const withoutFavorite = toggleFavorite(withFavorite, item);
    expect(withoutFavorite).toHaveLength(0);
  });

  it("un nouvel ajout après retrait capture un instantané frais", () => {
    const itemV1 = buildItem();
    const added = toggleFavorite([], itemV1);
    const removed = toggleFavorite(added, itemV1);

    const itemV2 = buildItem({ hasGarden: false }); // change le verdict de préférence
    const readded = toggleFavorite(removed, itemV2);
    expect(readded[0].softPreferenceScoreAtSave).toBe(itemV2.softPreferenceScore.score);
    expect(readded[0].softPreferenceScoreAtSave).not.toBe(itemV1.softPreferenceScore.score);
  });

  it("isFavorite retourne false pour un id absent", () => {
    expect(isFavorite([], "unknown-id")).toBe(false);
  });
});

describe("removeFavoriteById", () => {
  it("retire par id, laisse les autres intacts", () => {
    const item = buildItem();
    const favorites = toggleFavorite([], item);
    const other = createFavoriteSnapshot(buildItem({ id: "id2" }));
    const withTwo = [...favorites, other];
    const result = removeFavoriteById(withTwo, "id1");
    expect(result).toHaveLength(1);
    expect(result[0].listingId).toBe(other.listingId);
  });
});
