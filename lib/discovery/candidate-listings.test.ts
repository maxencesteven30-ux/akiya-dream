import { describe, expect, it } from "vitest";
import { createEmptyPropertyListing, type PropertyListing } from "@/lib/discovery/property-listing";
import {
  findCandidateListing,
  removeCandidateListing,
  upsertCandidateListing,
} from "@/lib/discovery/candidate-listings";

function listing(id: string, source: string, sourceListingId: string): PropertyListing {
  return createEmptyPropertyListing(id, source, sourceListingId, "2026-09-15T00:00:00.000Z");
}

describe("findCandidateListing", () => {
  it("trouve une entrée par source + sourceListingId", () => {
    const pool = [listing("1", "tomi-city", "322")];
    expect(findCandidateListing(pool, "tomi-city", "322")?.id).toBe("1");
  });

  it("retourne null si aucune correspondance, jamais une entrée approchante", () => {
    const pool = [listing("1", "tomi-city", "322")];
    expect(findCandidateListing(pool, "tomi-city", "999")).toBeNull();
    expect(findCandidateListing([], "tomi-city", "322")).toBeNull();
  });
});

describe("upsertCandidateListing", () => {
  it("ajoute une nouvelle annonce si aucune correspondance source+sourceListingId n'existe", () => {
    const pool = [listing("1", "tomi-city", "322")];
    const next = upsertCandidateListing(pool, listing("2", "murakami-city", "5"));
    expect(next).toHaveLength(2);
  });

  it("remplace au même index l'annonce existante, jamais un doublon", () => {
    const pool = [listing("1", "tomi-city", "322"), listing("2", "murakami-city", "5")];
    const updated = { ...listing("1", "tomi-city", "322"), priceJpy: 3_000_000 };

    const next = upsertCandidateListing(pool, updated);

    expect(next).toHaveLength(2);
    expect(next[0].priceJpy).toBe(3_000_000);
    expect(next[1].id).toBe("2");
  });

  it("ne mute jamais la liste d'origine", () => {
    const pool = [listing("1", "tomi-city", "322")];
    const original = [...pool];
    upsertCandidateListing(pool, listing("2", "murakami-city", "5"));
    expect(pool).toEqual(original);
  });
});

describe("removeCandidateListing", () => {
  it("retire l'annonce correspondant à l'id", () => {
    const pool = [listing("1", "tomi-city", "322"), listing("2", "murakami-city", "5")];
    const next = removeCandidateListing(pool, "1");
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("2");
  });

  it("ne fait rien (pas d'exception) si l'id est absent", () => {
    const pool = [listing("1", "tomi-city", "322")];
    expect(removeCandidateListing(pool, "999")).toEqual(pool);
  });
});
