import { describe, expect, it, vi } from "vitest";
import { fetchListingCityScore } from "@/lib/discovery/listing-city-score-bridge";
import { createEmptyPropertyListing } from "@/lib/discovery/property-listing";

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

function makeFetchImpl(handlers: Record<string, unknown>) {
  return vi.fn().mockImplementation((url: string) => {
    for (const [prefix, body] of Object.entries(handlers)) {
      if (url.startsWith(prefix)) return Promise.resolve(jsonResponse(body));
    }
    return Promise.resolve(jsonResponse({ status: "ERROR" }));
  });
}

describe("fetchListingCityScore", () => {
  it("retourne null si aucune donnée exploitable (pas de code municipal, pas de coordonnées, préfecture inconnue)", async () => {
    const listing = { ...createEmptyPropertyListing("id1", "test", "src1"), prefecture: "Quelque part" };
    const fetchImpl = makeFetchImpl({});
    expect(await fetchListingCityScore(listing, undefined, fetchImpl)).toBeNull();
  });

  it("calcule un score partiel (démographie seule) à partir du seul code municipal", async () => {
    const listing = { ...createEmptyPropertyListing("id1", "test", "src1"), municipalityCode: "32501" };
    const fetchImpl = makeFetchImpl({
      "/api/estat": { status: "AVAILABLE", data: { value: 1.5 } },
    });
    const result = await fetchListingCityScore(listing, undefined, fetchImpl);
    expect(result).not.toBeNull();
    expect(result!.axes).toHaveLength(1);
    expect(result!.axes[0].key).toBe("demographie");
    expect(result!.coverageIncomplete).toBe(true);
  });

  it("utilise directement les coordonnées du listing quand elles existent (jamais de résolution GSI)", async () => {
    const listing = {
      ...createEmptyPropertyListing("id1", "test", "src1"),
      latitude: 34.45,
      longitude: 131.76,
    };
    const fetchImpl = makeFetchImpl({
      "/api/hazard": { status: "OUTSIDE_ZONE" },
      "/api/amenities": { status: "NONE_IN_TILE", amenities: [] },
      "/api/stations": { status: "NONE_IN_TILE", stations: [] },
    });
    const result = await fetchListingCityScore(listing, undefined, fetchImpl);
    expect(result).not.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalledWith(expect.stringContaining("/api/geocoding/municipality-center"));
    const risques = result!.axes.find((a) => a.key === "risques");
    expect(risques?.score).toBe(10);
  });

  it("tente une résolution GSI uniquement si la préfecture correspond exactement à une préfecture réelle connue", async () => {
    const listing = {
      ...createEmptyPropertyListing("id1", "test", "src1"),
      prefecture: "島根県",
      municipality: "津和野町",
    };
    const fetchImpl = makeFetchImpl({
      "/api/geocoding/municipality-center": { point: { latitude: 34.45, longitude: 131.76 } },
      "/api/hazard": { status: "OUTSIDE_ZONE" },
      "/api/amenities": { status: "NONE_IN_TILE", amenities: [] },
      "/api/stations": { status: "NONE_IN_TILE", stations: [] },
    });
    const result = await fetchListingCityScore(listing, undefined, fetchImpl);
    expect(result).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/api/geocoding/municipality-center"));
  });

  it("ne tente jamais de résolution GSI pour une préfecture en texte libre non reconnue", async () => {
    const listing = {
      ...createEmptyPropertyListing("id1", "test", "src1"),
      prefecture: "quelque chose d'imprécis",
      municipality: "une ville",
      municipalityCode: "32501",
    };
    const fetchImpl = makeFetchImpl({
      "/api/estat": { status: "AVAILABLE", data: { value: 0.5 } },
    });
    const result = await fetchListingCityScore(listing, undefined, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalledWith(expect.stringContaining("/api/geocoding/municipality-center"));
    expect(result!.axes).toHaveLength(1);
  });

  it("transmet les priorités personnalisées au moteur City Score existant", async () => {
    const listing = { ...createEmptyPropertyListing("id1", "test", "src1"), municipalityCode: "32501" };
    const fetchImpl = makeFetchImpl({
      "/api/estat": { status: "AVAILABLE", data: { value: 1.5 } },
    });
    const withoutPriority = await fetchListingCityScore(listing, undefined, fetchImpl);
    const withPriority = await fetchListingCityScore(listing, { demographie: "important" }, fetchImpl);
    expect(withPriority!.axes[0].weight).toBeGreaterThan(withoutPriority!.axes[0].weight);
  });
});
