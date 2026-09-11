import { describe, expect, it } from "vitest";
import { getBuildingEra, getBuildingEraCode, getBuildingEraForYear } from "@/lib/building-eras";

describe("getBuildingEraCode", () => {
  it("classe avant 1981 en PRE_1981", () => {
    expect(getBuildingEraCode(1980)).toBe("PRE_1981");
    expect(getBuildingEraCode(1920)).toBe("PRE_1981");
  });

  it("classe 1981-1999 en POST_1981", () => {
    expect(getBuildingEraCode(1981)).toBe("POST_1981");
    expect(getBuildingEraCode(1999)).toBe("POST_1981");
  });

  it("classe 2000 et après en POST_2000", () => {
    expect(getBuildingEraCode(2000)).toBe("POST_2000");
    expect(getBuildingEraCode(2020)).toBe("POST_2000");
  });
});

describe("getBuildingEra", () => {
  it("retourne les valeurs exactes du jeu de données pour PRE_1981", () => {
    const era = getBuildingEra("PRE_1981");
    expect(era.avgPricePerSqmJpy).toBe(25000);
    expect(era.insulationCostPerSqmJpy).toBe(12000);
    expect(era.hvacCostPerSqmJpy).toBe(8000);
    expect(era.estimatedStructuralSurchargeJpy).toBe(4000000);
  });

  it("retourne les valeurs exactes du jeu de données pour POST_2000", () => {
    const era = getBuildingEra("POST_2000");
    expect(era.avgPricePerSqmJpy).toBe(50000);
    expect(era.insulationCostPerSqmJpy).toBe(3000);
    expect(era.hvacCostPerSqmJpy).toBe(4000);
    expect(era.estimatedStructuralSurchargeJpy).toBe(800000);
  });
});

describe("getBuildingEraForYear", () => {
  it("combine correctement l'année et l'ère associée", () => {
    expect(getBuildingEraForYear(1975).code).toBe("PRE_1981");
    expect(getBuildingEraForYear(1990).code).toBe("POST_1981");
    expect(getBuildingEraForYear(2015).code).toBe("POST_2000");
  });
});
