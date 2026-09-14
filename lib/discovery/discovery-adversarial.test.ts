import { describe, expect, it } from "vitest";
import { evaluateHardConstraints } from "@/lib/discovery/hard-constraint-engine";
import { rankListingsBySoftPreferences, scoreSoftPreferences } from "@/lib/discovery/soft-preference-ranking";
import { createEmptySearchProfile, type HardConstraints, type SoftPreferences } from "@/lib/discovery/search-profile";
import { createEmptyPropertyListing, type PropertyListing } from "@/lib/discovery/property-listing";
import { buildPropertyListingFromManualIntake, createEmptyManualIntakeInput } from "@/lib/discovery/manual-intake";
import { findCandidateListing, upsertCandidateListing } from "@/lib/discovery/candidate-listings";

// Phase AL — Adversarial / Epistemic Testing du pipeline de Discovery.
//
// Le but n'est pas de couvrir un module de plus (chaque module d'AE à
// AK a déjà sa propre suite) : c'est d'essayer de CASSER le raisonnement
// une fois les modules combinés, exactement comme lib/epistemic-adversarial.test.ts
// l'a fait pour le pipeline AC→AH. Aucun nouveau code de production
// n'est introduit ici. Cas nommés A→L.

function hc(overrides: Partial<HardConstraints> = {}): HardConstraints {
  return { ...createEmptySearchProfile().hardConstraints, ...overrides };
}

function sp(overrides: Partial<SoftPreferences> = {}): SoftPreferences {
  return { ...createEmptySearchProfile().softPreferences, ...overrides };
}

function listing(id: string, overrides: Partial<PropertyListing> = {}): PropertyListing {
  return { ...createEmptyPropertyListing(id, "tomi-city", id, "2026-09-15T00:00:00.000Z"), ...overrides };
}

describe("Cas A — un score de préférence douce élevé ne peut jamais renverser un FAIL des contraintes dures", () => {
  it("les deux moteurs restent structurellement indépendants", () => {
    const constraints = hc({ maxBudgetJpy: 5_000_000 });
    const preferences = sp({ preferredPrefectures: ["長野県"], wantsGarden: true });
    const bien = listing("1", { priceJpy: 20_000_000, prefecture: "長野県", hasGarden: true });

    const hardVerdict = evaluateHardConstraints(constraints, bien);
    const softScore = scoreSoftPreferences(preferences, bien);

    expect(hardVerdict.verdict).toBe("FAIL");
    expect(softScore.score).toBe(2);
  });
});

describe("Cas B — UNKNOWN ne devient jamais PASS même quand tous les autres critères passent", () => {
  it("un seul champ manquant suffit à garder le verdict global à UNKNOWN, jamais PASS", () => {
    const constraints = hc({ maxBudgetJpy: 10_000_000, minBuildingAreaM2: 50 });
    const bien = listing("1", { priceJpy: 8_000_000, buildingAreaM2: null });

    const verdict = evaluateHardConstraints(constraints, bien);

    expect(verdict.verdict).toBe("UNKNOWN");
    expect(verdict.verdict).not.toBe("PASS");
  });
});

describe("Cas C — pool de candidats vide", () => {
  it("aucune fonction du pipeline ne lève d'exception sur une liste vide", () => {
    expect(() => rankListingsBySoftPreferences(sp(), [])).not.toThrow();
    expect(rankListingsBySoftPreferences(sp(), [])).toEqual([]);
    expect(findCandidateListing([], "x", "y")).toBeNull();
  });
});

describe("Cas D — égalité stricte au budget maximum", () => {
  it("un prix exactement égal au budget maximum est PASS, jamais FAIL par excès de prudence", () => {
    const constraints = hc({ maxBudgetJpy: 10_000_000 });
    const bien = listing("1", { priceJpy: 10_000_000 });
    expect(evaluateHardConstraints(constraints, bien).verdict).toBe("PASS");
  });
});

describe("Cas E — égalité stricte à la surface minimale", () => {
  it("une surface exactement égale au minimum est PASS", () => {
    const constraints = hc({ minBuildingAreaM2: 80 });
    const bien = listing("1", { buildingAreaM2: 80 });
    expect(evaluateHardConstraints(constraints, bien).verdict).toBe("PASS");
  });
});

describe("Cas F — profil contradictoire (même préfecture à la fois exclue et préférée)", () => {
  it("l'exclusion dure gagne toujours : le bien FAIL même s'il correspond à la préférence douce", () => {
    const constraints = hc({ excludedPrefectures: ["長野県"] });
    const preferences = sp({ preferredPrefectures: ["長野県"] });
    const bien = listing("1", { prefecture: "長野県" });

    expect(evaluateHardConstraints(constraints, bien).verdict).toBe("FAIL");
    expect(scoreSoftPreferences(preferences, bien).score).toBe(1);
  });
});

describe("Cas G — distance à la gare en km jamais comparée à un seuil en minutes", () => {
  it("reste 'unknown', jamais 'matched' ni 'unmatched' par une conversion silencieuse", () => {
    const preferences = sp({ maxStationDistanceMinutes: 15 });
    const bien = listing("1", { stationDistance: { value: 0.5, unit: "km" } });
    const score = scoreSoftPreferences(preferences, bien);
    const result = score.matches.find((m) => m.criterionId === "maxStationDistanceMinutes");
    expect(result?.status).toBe("unknown");
  });
});

describe("Cas H — aller-retour complet saisie manuelle -> pool -> évaluation", () => {
  it("aucune donnée n'est inventée entre la saisie humaine et le verdict final", () => {
    const input = {
      ...createEmptyManualIntakeInput(),
      source: "tomi-city-akiyabank",
      sourceListingId: "322",
      priceRaw: "300万円",
      buildingAreaRaw: "90m²",
      prefecture: "長野県",
    };
    const bien = buildPropertyListingFromManualIntake("1", input, "2026-09-15T00:00:00.000Z");
    const pool = upsertCandidateListing([], bien);

    expect(pool).toHaveLength(1);
    const constraints = hc({ maxBudgetJpy: 5_000_000, minBuildingAreaM2: 50 });
    expect(evaluateHardConstraints(constraints, pool[0]).verdict).toBe("PASS");
  });
});

describe("Cas I — ressaisie d'une annonce déjà connue remplace, jamais un doublon fantôme", () => {
  it("le verdict reflète la nouvelle saisie, pas une fusion avec l'ancienne", () => {
    const stale = buildPropertyListingFromManualIntake(
      "1",
      { ...createEmptyManualIntakeInput(), source: "tomi-city", sourceListingId: "322", priceRaw: "300万円" },
    );
    const fresh = buildPropertyListingFromManualIntake(
      "2",
      { ...createEmptyManualIntakeInput(), source: "tomi-city", sourceListingId: "322", priceRaw: "800万円" },
    );

    const pool = upsertCandidateListing(upsertCandidateListing([], stale), fresh);

    expect(pool).toHaveLength(1);
    expect(pool[0].priceJpy).toBe(8_000_000);
    const constraints = hc({ maxBudgetJpy: 5_000_000 });
    expect(evaluateHardConstraints(constraints, pool[0]).verdict).toBe("FAIL");
  });
});

describe("Cas J — le classement par préférences douces ne modifie jamais le verdict des contraintes dures", () => {
  it("le verdict recalculé après classement est identique à celui calculé avant", () => {
    const constraints = hc({ maxBudgetJpy: 10_000_000 });
    const preferences = sp({ wantsGarden: true });
    const listings = [
      listing("cheap-no-garden", { priceJpy: 5_000_000, hasGarden: false }),
      listing("expensive-garden", { priceJpy: 20_000_000, hasGarden: true }),
    ];

    const ranked = rankListingsBySoftPreferences(preferences, listings);
    const expensiveRanked = ranked.find((r) => r.listing.id === "expensive-garden")!;

    // Il est en tête du classement (préférence jardin) mais reste FAIL
    // sur le budget — le classement ne "blanchit" jamais un FAIL.
    expect(ranked[0].listing.id).toBe("expensive-garden");
    expect(evaluateHardConstraints(constraints, expensiveRanked.listing).verdict).toBe("FAIL");
  });
});

describe("Cas K — le classement par préférences douces n'élimine personne, contrairement au moteur de contraintes dures", () => {
  it("un bien qui FAIL les contraintes dures reste présent et classé si on le lui soumet", () => {
    const preferences = sp({ wantsGarden: true });
    const bien = listing("1", { hasGarden: true });
    const ranked = rankListingsBySoftPreferences(preferences, [bien]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].listing.id).toBe("1");
  });
});

describe("Cas L — les critères sans champ comparable restent UNKNOWN quelle que soit la combinaison d'autres champs connus", () => {
  it("minBedrooms, ruralEnvironment, noCarRequired, renovationAcceptable ne sont jamais déduits d'un champ voisin", () => {
    const constraints = hc({ minBedrooms: 3 });
    const preferences = sp({ ruralEnvironment: true, noCarRequired: true, renovationAcceptable: true });
    // Un bien "complet" sur tous les autres champs, pour vérifier qu'aucun
    // d'entre eux ne sert de proxy implicite à ces 4 critères.
    const bien = listing("1", {
      roomCount: 5,
      buildingYear: 1930,
      prefecture: "長野県",
      municipality: "東御市",
      stationDistance: { value: 60, unit: "minutes_walk" },
      priceJpy: 1_000_000,
    });

    const hardVerdict = evaluateHardConstraints(constraints, bien);
    const softScore = scoreSoftPreferences(preferences, bien);

    expect(hardVerdict.checks.find((c) => c.criterionId === "minBedrooms")?.status).toBe("UNKNOWN");
    expect(softScore.matches.find((m) => m.criterionId === "ruralEnvironment")?.status).toBe("unknown");
    expect(softScore.matches.find((m) => m.criterionId === "noCarRequired")?.status).toBe("unknown");
    expect(softScore.matches.find((m) => m.criterionId === "renovationAcceptable")?.status).toBe("unknown");
    expect(softScore.score).toBe(0);
  });
});
