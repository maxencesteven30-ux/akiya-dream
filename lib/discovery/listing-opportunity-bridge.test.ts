import { describe, expect, it } from "vitest";
import { buildOpportunityInput, type OpportunityBridgeContext } from "@/lib/discovery/listing-opportunity-bridge";
import { createEmptyPropertyListing } from "@/lib/discovery/property-listing";
import { computeOpportunityScore } from "@/lib/opportunity";

const CONTEXT: OpportunityBridgeContext = {
  profile: "solo",
  renovationLevel: "leger",
  region: null,
};

describe("buildOpportunityInput", () => {
  it("retourne null si le listing n'a pas de prix connu", () => {
    const listing = createEmptyPropertyListing("id1", "test", "src1");
    expect(buildOpportunityInput(listing, CONTEXT)).toBeNull();
  });

  it("mappe correctement les champs réels vers RealListing", () => {
    const listing = {
      ...createEmptyPropertyListing("id1", "test", "src1"),
      title: "Maison à Tsuwano",
      priceJpy: 3_000_000,
      municipality: "津和野町",
      municipalityCode: "32501",
      latitude: 34.45,
      longitude: 131.76,
      buildingAreaM2: 90,
      landAreaM2: 300,
      buildingYear: 1978,
      stationDistance: { value: 1.2, unit: "km" as const },
    };

    const input = buildOpportunityInput(listing, CONTEXT);
    expect(input).not.toBeNull();
    expect(input!.prixAchatJpy).toBe(3_000_000);
    expect(input!.listing).toEqual({
      name: "Maison à Tsuwano",
      city: "津和野町",
      latitude: 34.45,
      longitude: 131.76,
      municipalityCode: "32501",
      surfaceM2: 90,
      landM2: 300,
      constructionYear: 1978,
      stationDistanceKm: 1.2,
      condition: "unknown",
    });
  });

  it("condition reste toujours 'unknown' -- jamais devinée depuis un champ Reality Gate", () => {
    const listing = {
      ...createEmptyPropertyListing("id1", "test", "src1"),
      priceJpy: 3_000_000,
      roadAccess: "verifie" as const,
      rebuildability: "verifie" as const,
    };
    const input = buildOpportunityInput(listing, CONTEXT);
    expect(input!.listing.condition).toBe("unknown");
  });

  it("ne convertit jamais une distance en minutes de marche vers des km", () => {
    const listing = {
      ...createEmptyPropertyListing("id1", "test", "src1"),
      priceJpy: 3_000_000,
      stationDistance: { value: 15, unit: "minutes_walk" as const },
    };
    const input = buildOpportunityInput(listing, CONTEXT);
    expect(input!.listing.stationDistanceKm).toBeNull();
  });

  it("le résultat est directement consommable par computeOpportunityScore sans adaptation", () => {
    const listing = {
      ...createEmptyPropertyListing("id1", "test", "src1"),
      priceJpy: 3_000_000,
      buildingAreaM2: 80,
      buildingYear: 1990,
    };
    const input = buildOpportunityInput(listing, CONTEXT);
    expect(() => computeOpportunityScore(input!)).not.toThrow();
    const result = computeOpportunityScore(input!);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
  });
});
