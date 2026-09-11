import { describe, expect, it } from "vitest";
import { getAllHiddenCosts, getHiddenCost, getHiddenCostMidpoint } from "@/lib/hidden-costs";

describe("getAllHiddenCosts", () => {
  it("retourne les 8 postes attendus", () => {
    const all = getAllHiddenCosts();
    expect(all.length).toBe(8);
    expect(all.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        "HC_BACK_TAXES",
        "HC_SURVEY_BOUND",
        "HC_SEPTIC_CLEAN",
        "HC_DEMOLITION_SHED",
        "HC_PEST_EXTERMINATE",
        "HC_NEIGHBORHOOD_HOA",
        "HC_SNOW_REMOVAL",
        "HC_UTILITIES_CONNECT",
      ]),
    );
  });
});

describe("getHiddenCost", () => {
  it("lève une erreur explicite pour un identifiant inconnu", () => {
    expect(() => getHiddenCost("UNKNOWN")).toThrow();
  });
});

describe("getHiddenCostMidpoint", () => {
  it("calcule le milieu exact de la fourchette pour chaque poste utilisé par le moteur", () => {
    expect(getHiddenCostMidpoint("HC_BACK_TAXES")).toBe(150000);
    expect(getHiddenCostMidpoint("HC_SURVEY_BOUND")).toBe(275000);
    expect(getHiddenCostMidpoint("HC_SEPTIC_CLEAN")).toBe(100000);
    expect(getHiddenCostMidpoint("HC_PEST_EXTERMINATE")).toBe(325000);
    expect(getHiddenCostMidpoint("HC_NEIGHBORHOOD_HOA")).toBe(21000);
    expect(getHiddenCostMidpoint("HC_SNOW_REMOVAL")).toBe(100000);
  });
});
