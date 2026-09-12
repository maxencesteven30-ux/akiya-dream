import { describe, expect, it } from "vitest";
import {
  computeGeographicPrecision,
  hasSufficientPrecisionForHazardAnalysis,
  isValidLatitude,
  isValidLongitude,
} from "@/lib/geo-precision";

describe("computeGeographicPrecision", () => {
  it("EXACT quand latitude et longitude sont renseignées", () => {
    expect(computeGeographicPrecision({ city: "Nagano", latitude: 36.65, longitude: 138.18 })).toBe("EXACT");
  });

  it("MUNICIPALITY quand seule la ville est renseignée", () => {
    expect(computeGeographicPrecision({ city: "Nagano", latitude: null, longitude: null })).toBe("MUNICIPALITY");
  });

  it("INSUFFICIENT quand rien n'est renseigné", () => {
    expect(computeGeographicPrecision({ city: "", latitude: null, longitude: null })).toBe("INSUFFICIENT");
  });

  it("INSUFFICIENT si la ville n'est que des espaces", () => {
    expect(computeGeographicPrecision({ city: "   ", latitude: null, longitude: null })).toBe("INSUFFICIENT");
  });

  it("EXACT prime même si la ville est vide (coordonnées suffisent)", () => {
    expect(computeGeographicPrecision({ city: "", latitude: 36.65, longitude: 138.18 })).toBe("EXACT");
  });

  it("une seule coordonnée sur deux ne suffit pas : reste MUNICIPALITY/INSUFFICIENT", () => {
    expect(computeGeographicPrecision({ city: "Nagano", latitude: 36.65, longitude: null })).toBe("MUNICIPALITY");
    expect(computeGeographicPrecision({ city: "", latitude: null, longitude: 138.18 })).toBe("INSUFFICIENT");
  });

  it("un état persisté avant l'ajout des coordonnées (latitude/longitude undefined) n'est jamais traité comme EXACT", () => {
    // Régression : un projet sauvegardé avant cette fonctionnalité n'a pas
    // ces clés du tout (undefined, pas null) — trouvé lors de la
    // vérification navigateur.
    const legacyInput = { city: "", latitude: undefined, longitude: undefined } as unknown as {
      city: string;
      latitude: number | null;
      longitude: number | null;
    };
    expect(computeGeographicPrecision(legacyInput)).toBe("INSUFFICIENT");
  });
});

describe("hasSufficientPrecisionForHazardAnalysis", () => {
  it("seule EXACT est suffisante pour une analyse de risque géographique", () => {
    expect(hasSufficientPrecisionForHazardAnalysis("EXACT")).toBe(true);
    expect(hasSufficientPrecisionForHazardAnalysis("APPROXIMATE")).toBe(false);
    expect(hasSufficientPrecisionForHazardAnalysis("MUNICIPALITY")).toBe(false);
    expect(hasSufficientPrecisionForHazardAnalysis("INSUFFICIENT")).toBe(false);
  });
});

describe("isValidLatitude / isValidLongitude", () => {
  it("rejette les valeurs hors plage", () => {
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(-91)).toBe(false);
    expect(isValidLongitude(181)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
  });

  it("accepte les valeurs dans la plage, y compris les bornes", () => {
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLatitude(36.65)).toBe(true);
  });
});
