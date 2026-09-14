import { describe, expect, it } from "vitest";
import { createEmptyPropertyListing } from "@/lib/discovery/property-listing";

describe("createEmptyPropertyListing", () => {
  it("tout champ non fourni reste null, jamais une valeur favorable/neutre par défaut", () => {
    const listing = createEmptyPropertyListing("1", "test-source", "abc", "2026-09-15T00:00:00.000Z");
    expect(listing.priceJpy).toBeNull();
    expect(listing.rebuildability).toBeNull();
    expect(listing.roadAccess).toBeNull();
    expect(listing.water).toBeNull();
    expect(listing.latitude).toBeNull();
  });

  it("le statut de disponibilité par défaut est UNKNOWN, jamais ACTIVE", () => {
    const listing = createEmptyPropertyListing("1", "test-source", "abc");
    expect(listing.availabilityStatus).toBe("UNKNOWN");
  });

  it("conserve id/source/sourceListingId/retrievedAt tels que fournis", () => {
    const listing = createEmptyPropertyListing("42", "akiya-bank-nagano", "L-001", "2026-09-15T00:00:00.000Z");
    expect(listing.id).toBe("42");
    expect(listing.source).toBe("akiya-bank-nagano");
    expect(listing.sourceListingId).toBe("L-001");
    expect(listing.retrievedAt).toBe("2026-09-15T00:00:00.000Z");
  });

  it("horodate retrievedAt automatiquement si non fourni", () => {
    const listing = createEmptyPropertyListing("1", "test-source", "abc");
    expect(() => new Date(listing.retrievedAt)).not.toThrow();
    expect(listing.retrievedAt).toBeTruthy();
  });
});
