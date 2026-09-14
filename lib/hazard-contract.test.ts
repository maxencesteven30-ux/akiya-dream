import { describe, expect, it } from "vitest";
import { checkHazardZone, HAZARD_CATEGORY_LABELS, type HazardCategory } from "@/lib/hazard-contract";

const CATEGORIES: HazardCategory[] = ["flood", "landslide", "tsunami", "storm_surge", "evacuation_shelter"];

describe("checkHazardZone", () => {
  it("INSUFFICIENT_PRECISION pour toute précision autre qu'EXACT", () => {
    for (const category of CATEGORIES) {
      expect(checkHazardZone(category, "MUNICIPALITY").status).toBe("INSUFFICIENT_PRECISION");
      expect(checkHazardZone(category, "APPROXIMATE").status).toBe("INSUFFICIENT_PRECISION");
      expect(checkHazardZone(category, "INSUFFICIENT").status).toBe("INSUFFICIENT_PRECISION");
    }
  });

  it("DATA_UNAVAILABLE même avec une précision EXACTE : aucun verdict de sécurité inventé", () => {
    const result = checkHazardZone("flood", "EXACT");
    expect(result.status).toBe("DATA_UNAVAILABLE");
    expect(result.status).not.toBe("IN_ZONE");
    expect(result.status).not.toBe("OUTSIDE_ZONE");
  });

  it("chaque catégorie a un libellé, aucune inventée en dehors des 5 documentées", () => {
    expect(Object.keys(HAZARD_CATEGORY_LABELS)).toHaveLength(5);
  });

  it("les métadonnées incluent toujours la précision géographique utilisée", () => {
    const result = checkHazardZone("tsunami", "EXACT");
    expect(result.metadata.geographicPrecision).toBe("EXACT");
    expect(result.metadata.fetchedAt).toBeTruthy();
  });
});
