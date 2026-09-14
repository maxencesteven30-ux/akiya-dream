import { describe, expect, it } from "vitest";
import { parsePopulationMeshFeature } from "@/lib/demographics/population-mesh";

describe("parsePopulationMeshFeature", () => {
  it("extrait population totale et ratio 75+ pour chaque année présente, triées", () => {
    const points = parsePopulationMeshFeature({
      PT00_2030: 10.5,
      RTD_2030: 0.3,
      HITOKU2030: "",
      PT00_2025: 12.1,
      RTD_2025: 0.25,
      HITOKU2025: "",
    });

    expect(points.map((p) => p.year)).toEqual([2025, 2030]);
    expect(points[0]).toEqual({
      year: 2025,
      totalPopulation: 12.1,
      elderlyRatio75Plus: 0.25,
      suppressed: false,
    });
  });

  it("une année marquée par un symbole de confidentialité non vide reste 'suppressed', jamais un chiffre présenté comme un fait", () => {
    const points = parsePopulationMeshFeature({
      PT00_2050: 0.5,
      RTD_2050: 0.8,
      HITOKU2050: "*",
    });

    expect(points[0].suppressed).toBe(true);
    expect(points[0].totalPopulation).toBeNull();
    expect(points[0].elderlyRatio75Plus).toBeNull();
  });

  it("HITOKU vide ou absent ne déclenche jamais la suppression", () => {
    const withEmpty = parsePopulationMeshFeature({ PT00_2030: 5, HITOKU2030: "" });
    const withoutField = parsePopulationMeshFeature({ PT00_2030: 5 });
    expect(withEmpty[0].suppressed).toBe(false);
    expect(withoutField[0].suppressed).toBe(false);
  });

  it("un champ non numérique pour PT00/RTD reste null, jamais une valeur devinée", () => {
    const points = parsePopulationMeshFeature({ PT00_2030: "n/a", RTD_2030: null });
    expect(points[0].totalPopulation).toBeNull();
    expect(points[0].elderlyRatio75Plus).toBeNull();
  });

  it("aucune propriété PT00_* ne produit une liste vide, jamais une exception", () => {
    expect(parsePopulationMeshFeature({})).toEqual([]);
    expect(() => parsePopulationMeshFeature({})).not.toThrow();
  });

  it("ignore les clés qui ressemblent à PT00_ sans être une année à 4 chiffres", () => {
    const points = parsePopulationMeshFeature({ PT00_ABCD: 5, PT00_20301: 5, PT00_2030: 7 });
    expect(points).toHaveLength(1);
    expect(points[0].year).toBe(2030);
  });
});
