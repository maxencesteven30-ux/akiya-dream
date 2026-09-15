import { describe, expect, it } from "vitest";
import { computeAverageLandPricePerSqm } from "@/lib/mlit/land-price-stats";
import type { OfficialLandPricePoint } from "@/lib/mlit/land-price-types";

function makePoint(pricePerSqmJpy: number): OfficialLandPricePoint {
  return {
    pointId: 1,
    priceType: "national",
    targetYear: "令和8年",
    prefecture: "鹿児島県",
    municipality: "鹿児島市",
    placeName: null,
    standardLotNumber: null,
    useCategory: null,
    pricePerSqmJpy,
    cityCode: "46201",
    latitude: 31.6,
    longitude: 130.5,
  };
}

describe("computeAverageLandPricePerSqm", () => {
  it("retourne null pour une liste vide", () => {
    expect(computeAverageLandPricePerSqm([])).toBeNull();
  });

  it("calcule la moyenne réelle sur plusieurs points", () => {
    const result = computeAverageLandPricePerSqm([makePoint(100_000), makePoint(200_000)]);
    expect(result).toEqual({ averagePricePerSqmJpy: 150_000, sampleSize: 2 });
  });

  it("fonctionne avec un seul point", () => {
    expect(computeAverageLandPricePerSqm([makePoint(123_456)])).toEqual({
      averagePricePerSqmJpy: 123_456,
      sampleSize: 1,
    });
  });
});
