import { describe, expect, it } from "vitest";
import { countListingsByRegion } from "@/lib/discovery/listing-region-match";
import { createEmptyPropertyListing } from "@/lib/discovery/property-listing";
import type { PropertyListing } from "@/lib/discovery/property-listing";
import type { Region } from "@/lib/types";

function makeListing(id: string, prefecture: string | null): PropertyListing {
  return { ...createEmptyPropertyListing(id, "src", `${id}-src`), prefecture };
}

const KAGOSHIMA: Region = {
  prefecture: "Kagoshima",
  medianPriceJpy: 3_800_000,
  medianAgeYears: 36,
  pre1981Percent: 33,
  subsidyMaxJpy: 0,
  recommendationLevel: "C",
};

const FUKUOKA_PERIPH: Region = {
  prefecture: "Fukuoka_Periph",
  medianPriceJpy: 4_800_000,
  medianAgeYears: 35,
  pre1981Percent: 30,
  subsidyMaxJpy: 0,
  recommendationLevel: "B",
};

describe("countListingsByRegion", () => {
  it("compte les biens dont la préfecture (nom japonais ou anglais) correspond exactement", () => {
    const listings = [makeListing("a", "鹿児島県"), makeListing("b", "Kagoshima"), makeListing("c", "Kagoshima")];
    const counts = countListingsByRegion(listings, [KAGOSHIMA]);
    expect(counts.get("Kagoshima")).toBe(3);
  });

  it("ne compte jamais un bien dont la préfecture est inconnue ou non reconnue", () => {
    const listings = [makeListing("a", null), makeListing("b", "quelque part"), makeListing("c", "Kagoshima")];
    const counts = countListingsByRegion(listings, [KAGOSHIMA]);
    expect(counts.get("Kagoshima")).toBe(1);
    expect(counts.size).toBe(1);
  });

  it("rattache un bien de la préfecture entière à la sous-région composite existante (même convention que la carte)", () => {
    const listings = [makeListing("a", "福岡県")];
    const counts = countListingsByRegion(listings, [FUKUOKA_PERIPH]);
    expect(counts.get("Fukuoka_Periph")).toBe(1);
  });

  it("retourne une Map vide pour un pool vide", () => {
    expect(countListingsByRegion([], [KAGOSHIMA]).size).toBe(0);
  });

  it("ne compte pas un bien dont la préfecture réelle n'a pas de région curatée correspondante", () => {
    const listings = [makeListing("a", "東京都")]; // Tokyo, pas dans data/regions.json
    const counts = countListingsByRegion(listings, [KAGOSHIMA]);
    expect(counts.size).toBe(0);
  });
});
