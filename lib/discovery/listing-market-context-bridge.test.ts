import { describe, expect, it, vi } from "vitest";
import { fetchListingMarketContext } from "@/lib/discovery/listing-market-context-bridge";
import { createEmptyPropertyListing } from "@/lib/discovery/property-listing";
import type { MlitTransaction } from "@/lib/mlit/types";

function makeTransaction(overrides: Partial<MlitTransaction>): MlitTransaction {
  return {
    municipalityCode: "32501",
    prefecture: "島根県",
    municipality: "津和野町",
    districtName: "",
    tradePriceJpy: 3_000_000,
    areaM2: null,
    totalFloorAreaM2: 90,
    buildingYear: 1978,
    structure: null,
    use: null,
    landShape: null,
    cityPlanning: null,
    period: "2025年第2四半期",
    districtCode: "",
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

describe("fetchListingMarketContext", () => {
  it("retourne null si le prix est inconnu", async () => {
    const listing = { ...createEmptyPropertyListing("id1", "test", "src1"), municipalityCode: "32501" };
    const fetchImpl = vi.fn();
    expect(await fetchListingMarketContext(listing, fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retourne null si la municipalité est inconnue", async () => {
    const listing = { ...createEmptyPropertyListing("id1", "test", "src1"), priceJpy: 3_000_000 };
    const fetchImpl = vi.fn();
    expect(await fetchListingMarketContext(listing, fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("agrège les transactions réelles de plusieurs trimestres et calcule un contexte de marché", async () => {
    const listing = {
      ...createEmptyPropertyListing("id1", "test", "src1"),
      priceJpy: 2_500_000,
      municipalityCode: "32501",
      buildingAreaM2: 90,
      buildingYear: 1978,
    };
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes("quarter=1")) {
        return Promise.resolve(
          jsonResponse({ status: "AVAILABLE", data: [makeTransaction({ tradePriceJpy: 3_000_000 })] }),
        );
      }
      return Promise.resolve(jsonResponse({ status: "NOT_FOUND", data: [] }));
    });

    const context = await fetchListingMarketContext(listing, fetchImpl);
    expect(context).not.toBeNull();
    expect(context!.comparison.totalTransactions).toBeGreaterThanOrEqual(1);
  });

  it("ne plante jamais quand toutes les requêtes échouent -- statut le plus honnête possible", async () => {
    const listing = {
      ...createEmptyPropertyListing("id1", "test", "src1"),
      priceJpy: 2_500_000,
      municipalityCode: "32501",
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: "ERROR", data: [] }));
    const context = await fetchListingMarketContext(listing, fetchImpl);
    expect(context).not.toBeNull();
    expect(context!.level).toBe("indisponible");
  });
});
