import { describe, expect, it } from "vitest";
import { rankListingsBySoftPreferences, scoreSoftPreferences } from "@/lib/discovery/soft-preference-ranking";
import { createEmptySearchProfile, type SoftPreferences } from "@/lib/discovery/search-profile";
import { createEmptyPropertyListing, type PropertyListing } from "@/lib/discovery/property-listing";

function emptyPreferences(): SoftPreferences {
  return createEmptySearchProfile().softPreferences;
}

function listing(id: string, overrides: Partial<PropertyListing> = {}): PropertyListing {
  return { ...createEmptyPropertyListing(id, "tomi-city", id, "2026-09-15T00:00:00.000Z"), ...overrides };
}

function statusOf(score: ReturnType<typeof scoreSoftPreferences>, criterionId: string) {
  return score.matches.find((m) => m.criterionId === criterionId)?.status;
}

describe("scoreSoftPreferences — aucune préférence activée", () => {
  it("score 0, tout en not_active", () => {
    const score = scoreSoftPreferences(emptyPreferences(), listing("1"));
    expect(score.score).toBe(0);
    expect(score.activeCriteriaCount).toBe(0);
    expect(score.matches.every((m) => m.status === "not_active")).toBe(true);
  });
});

describe("preferredPrefectures", () => {
  it("matched si la préfecture connue est dans la liste préférée", () => {
    const prefs = { ...emptyPreferences(), preferredPrefectures: ["長野県"] };
    const score = scoreSoftPreferences(prefs, listing("1", { prefecture: "長野県" }));
    expect(statusOf(score, "preferredPrefectures")).toBe("matched");
    expect(score.score).toBe(1);
  });

  it("unmatched si la préfecture connue n'est pas dans la liste, jamais éliminé (pas de status FAIL)", () => {
    const prefs = { ...emptyPreferences(), preferredPrefectures: ["長野県"] };
    const score = scoreSoftPreferences(prefs, listing("1", { prefecture: "岡山県" }));
    expect(statusOf(score, "preferredPrefectures")).toBe("unmatched");
  });

  it("unknown si la préfecture de l'annonce est inconnue", () => {
    const prefs = { ...emptyPreferences(), preferredPrefectures: ["長野県"] };
    const score = scoreSoftPreferences(prefs, listing("1", { prefecture: null }));
    expect(statusOf(score, "preferredPrefectures")).toBe("unknown");
    expect(score.score).toBe(0);
  });
});

describe("wantsGarden", () => {
  it("matched quand hasGarden correspond exactement à la préférence (y compris false=false)", () => {
    const prefs = { ...emptyPreferences(), wantsGarden: false };
    const score = scoreSoftPreferences(prefs, listing("1", { hasGarden: false }));
    expect(statusOf(score, "wantsGarden")).toBe("matched");
  });

  it("unknown si hasGarden n'est pas renseigné", () => {
    const prefs = { ...emptyPreferences(), wantsGarden: true };
    const score = scoreSoftPreferences(prefs, listing("1", { hasGarden: null }));
    expect(statusOf(score, "wantsGarden")).toBe("unknown");
  });
});

describe("maxStationDistanceMinutes", () => {
  it("matched si la distance en minutes à pied est sous le maximum", () => {
    const prefs = { ...emptyPreferences(), maxStationDistanceMinutes: 15 };
    const score = scoreSoftPreferences(
      prefs,
      listing("1", { stationDistance: { value: 10, unit: "minutes_walk" } }),
    );
    expect(statusOf(score, "maxStationDistanceMinutes")).toBe("matched");
  });

  it("unmatched si la distance dépasse le maximum", () => {
    const prefs = { ...emptyPreferences(), maxStationDistanceMinutes: 15 };
    const score = scoreSoftPreferences(
      prefs,
      listing("1", { stationDistance: { value: 20, unit: "minutes_walk" } }),
    );
    expect(statusOf(score, "maxStationDistanceMinutes")).toBe("unmatched");
  });

  it("unknown si l'unité est en km, jamais convertie en minutes", () => {
    const prefs = { ...emptyPreferences(), maxStationDistanceMinutes: 15 };
    const score = scoreSoftPreferences(prefs, listing("1", { stationDistance: { value: 1, unit: "km" } }));
    expect(statusOf(score, "maxStationDistanceMinutes")).toBe("unknown");
  });
});

describe("préférences sans champ comparable (ruralEnvironment, noCarRequired, renovationAcceptable)", () => {
  it("restent 'unknown' dès qu'activées, jamais devinées à partir d'un autre champ", () => {
    const prefs: SoftPreferences = {
      ...emptyPreferences(),
      ruralEnvironment: true,
      noCarRequired: true,
      renovationAcceptable: true,
    };
    const score = scoreSoftPreferences(prefs, listing("1", { buildingYear: 1950 }));
    expect(statusOf(score, "ruralEnvironment")).toBe("unknown");
    expect(statusOf(score, "noCarRequired")).toBe("unknown");
    expect(statusOf(score, "renovationAcceptable")).toBe("unknown");
    expect(score.score).toBe(0);
  });
});

describe("rankListingsBySoftPreferences", () => {
  it("trie par score décroissant sans jamais retirer un bien de la liste", () => {
    const prefs = { ...emptyPreferences(), preferredPrefectures: ["長野県"], wantsGarden: true };
    const listings = [
      listing("low", { prefecture: "岡山県", hasGarden: false }),
      listing("high", { prefecture: "長野県", hasGarden: true }),
      listing("unknown", { prefecture: null, hasGarden: null }),
    ];

    const ranked = rankListingsBySoftPreferences(prefs, listings);

    expect(ranked).toHaveLength(3);
    expect(ranked[0].listing.id).toBe("high");
    expect(ranked.map((r) => r.listing.id)).toContain("low");
    expect(ranked.map((r) => r.listing.id)).toContain("unknown");
  });

  it("une inconnue ne fait jamais baisser le score sous celui d'un mismatch connu", () => {
    const prefs = { ...emptyPreferences(), wantsGarden: true };
    const mismatch = scoreSoftPreferences(prefs, listing("1", { hasGarden: false }));
    const unknown = scoreSoftPreferences(prefs, listing("2", { hasGarden: null }));
    expect(mismatch.score).toBe(unknown.score);
  });
});
