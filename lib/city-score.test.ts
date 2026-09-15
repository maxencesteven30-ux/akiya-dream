import { describe, expect, it } from "vitest";
import { categorizeCityScore, computeCityScore, type ComputeCityScoreInput } from "@/lib/city-score";

const EMPTY_INPUT: ComputeCityScoreInput = {
  populationChangeRatePercent: null,
  hazards: [],
  amenities: [],
  station: null,
};

describe("categorizeCityScore", () => {
  it("respecte les bornes exactes des catégories", () => {
    expect(categorizeCityScore(0)).toBe("faible");
    expect(categorizeCityScore(3.9)).toBe("faible");
    expect(categorizeCityScore(4)).toBe("moyenne");
    expect(categorizeCityScore(5.9)).toBe("moyenne");
    expect(categorizeCityScore(6)).toBe("bonne");
    expect(categorizeCityScore(7.9)).toBe("bonne");
    expect(categorizeCityScore(8)).toBe("tres_bonne");
    expect(categorizeCityScore(10)).toBe("tres_bonne");
  });
});

describe("computeCityScore", () => {
  it("retourne null si aucun axe n'a de donnée disponible", () => {
    const result = computeCityScore(EMPTY_INPUT);
    expect(result.score).toBeNull();
    expect(result.category).toBeNull();
    expect(result.axes).toHaveLength(0);
    expect(result.coverageIncomplete).toBe(true);
  });

  it("population en croissance nette -> axe démographie élevé", () => {
    const result = computeCityScore({ ...EMPTY_INPUT, populationChangeRatePercent: 2 });
    const demo = result.axes.find((a) => a.key === "demographie")!;
    expect(demo.score).toBe(10);
  });

  it("population stable -> axe démographie neutre (6)", () => {
    const result = computeCityScore({ ...EMPTY_INPUT, populationChangeRatePercent: 0 });
    const demo = result.axes.find((a) => a.key === "demographie")!;
    expect(demo.score).toBe(6);
  });

  it("déclin démographique marqué -> axe démographie proche de 0", () => {
    const result = computeCityScore({ ...EMPTY_INPUT, populationChangeRatePercent: -5 });
    const demo = result.axes.find((a) => a.key === "demographie")!;
    expect(demo.score).toBe(0);
  });

  it("aucune zone de risque -> axe risques maximal", () => {
    const result = computeCityScore({
      ...EMPTY_INPUT,
      hazards: [
        { category: "flood", status: "OUTSIDE_ZONE" },
        { category: "tsunami", status: "OUTSIDE_ZONE" },
      ],
    });
    const risques = result.axes.find((a) => a.key === "risques")!;
    expect(risques.score).toBe(10);
  });

  it("3 zones de risque ou plus -> axe risques à 0", () => {
    const result = computeCityScore({
      ...EMPTY_INPUT,
      hazards: [
        { category: "flood", status: "IN_ZONE" },
        { category: "tsunami", status: "IN_ZONE" },
        { category: "storm_surge", status: "IN_ZONE" },
      ],
    });
    const risques = result.axes.find((a) => a.key === "risques")!;
    expect(risques.score).toBe(0);
  });

  it("catégories de risque non déterminées sont exclues, jamais comptées comme sûres", () => {
    const result = computeCityScore({
      ...EMPTY_INPUT,
      hazards: [
        { category: "flood", status: "DATA_UNAVAILABLE" },
        { category: "tsunami", status: "ERROR" },
      ],
    });
    expect(result.axes.find((a) => a.key === "risques")).toBeUndefined();
  });

  it("service très proche -> score élevé, service lointain -> score bas", () => {
    const proche = computeCityScore({
      ...EMPTY_INPUT,
      amenities: [{ category: "school", status: "FOUND", nearestDistanceMeters: 200 }],
    });
    const lointain = computeCityScore({
      ...EMPTY_INPUT,
      amenities: [{ category: "school", status: "FOUND", nearestDistanceMeters: 4800 }],
    });
    expect(proche.axes[0].score).toBeGreaterThan(lointain.axes[0].score);
  });

  it("gare proche avec JR à proximité -> bonus appliqué, plafonné à 10", () => {
    const result = computeCityScore({
      ...EMPTY_INPUT,
      station: { status: "FOUND", nearestDistanceMeters: 300, nearestJrDistanceMeters: 300 },
    });
    const gare = result.axes.find((a) => a.key === "gare")!;
    expect(gare.score).toBe(10);
  });

  it("gare proche sans JR à proximité -> pas de bonus", () => {
    const result = computeCityScore({
      ...EMPTY_INPUT,
      station: { status: "FOUND", nearestDistanceMeters: 1000, nearestJrDistanceMeters: null },
    });
    const gare = result.axes.find((a) => a.key === "gare")!;
    expect(gare.score).toBe(8);
  });

  it("couverture complète (4 axes) -> coverageIncomplete à false", () => {
    const result = computeCityScore({
      populationChangeRatePercent: 1,
      hazards: [{ category: "flood", status: "OUTSIDE_ZONE" }],
      amenities: [{ category: "school", status: "FOUND", nearestDistanceMeters: 500 }],
      station: { status: "FOUND", nearestDistanceMeters: 500, nearestJrDistanceMeters: null },
    });
    expect(result.axes).toHaveLength(4);
    expect(result.coverageIncomplete).toBe(false);
    expect(result.score).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("couverture partielle (moins de 4 axes) -> coverageIncomplete à true, score quand même calculable", () => {
    const result = computeCityScore({
      ...EMPTY_INPUT,
      populationChangeRatePercent: 1,
    });
    expect(result.axes).toHaveLength(1);
    expect(result.coverageIncomplete).toBe(true);
    expect(result.score).not.toBeNull();
  });

  it("score toujours borné entre 0 et 100", () => {
    const best = computeCityScore({
      populationChangeRatePercent: 5,
      hazards: [{ category: "flood", status: "OUTSIDE_ZONE" }],
      amenities: [{ category: "school", status: "FOUND", nearestDistanceMeters: 0 }],
      station: { status: "FOUND", nearestDistanceMeters: 0, nearestJrDistanceMeters: 0 },
    });
    const worst = computeCityScore({
      populationChangeRatePercent: -10,
      hazards: [
        { category: "flood", status: "IN_ZONE" },
        { category: "tsunami", status: "IN_ZONE" },
        { category: "storm_surge", status: "IN_ZONE" },
        { category: "landslide", status: "IN_ZONE" },
      ],
      amenities: [{ category: "school", status: "FOUND", nearestDistanceMeters: 10_000 }],
      station: { status: "FOUND", nearestDistanceMeters: 10_000, nearestJrDistanceMeters: null },
    });
    expect(best.score).toBe(100);
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});

describe("computeCityScore avec priorités personnalisées", () => {
  const FULL_COVERAGE_INPUT: ComputeCityScoreInput = {
    populationChangeRatePercent: 5, // axe démographie au maximum (10/10)
    hazards: [
      { category: "flood", status: "IN_ZONE" },
      { category: "tsunami", status: "IN_ZONE" },
      { category: "storm_surge", status: "IN_ZONE" },
      { category: "landslide", status: "IN_ZONE" },
    ], // axe risques au minimum (0/10)
    amenities: [{ category: "school", status: "FOUND", nearestDistanceMeters: 500 }],
    station: { status: "FOUND", nearestDistanceMeters: 500, nearestJrDistanceMeters: null },
  };

  it("sans priorité, les 4 axes gardent un poids égal (comportement historique)", () => {
    const result = computeCityScore(FULL_COVERAGE_INPUT);
    const weights = result.axes.map((a) => a.weight);
    expect(new Set(weights)).toEqual(new Set([25]));
  });

  it("marquer un axe 'important' augmente son poids, sans exclure les autres", () => {
    const result = computeCityScore(FULL_COVERAGE_INPUT, { demographie: "important" });
    const demo = result.axes.find((a) => a.key === "demographie")!;
    const others = result.axes.filter((a) => a.key !== "demographie");
    expect(demo.weight).toBeGreaterThan(25);
    for (const axis of others) {
      expect(axis.weight).toBe(25); // non priorisés : poids par défaut inchangé
    }
  });

  it("marquer un axe 'peu_importe' réduit son poids sans jamais l'exclure (axe toujours présent)", () => {
    const result = computeCityScore(FULL_COVERAGE_INPUT, { risques: "peu_importe" });
    const risques = result.axes.find((a) => a.key === "risques")!;
    expect(risques.weight).toBeLessThan(25);
    expect(risques.weight).toBeGreaterThan(0);
    expect(result.axes).toHaveLength(4); // l'axe reste affiché, jamais retiré
  });

  it("prioriser l'axe où la ville excelle augmente son score global par rapport à prioriser l'axe faible", () => {
    // démographie = 10/10 (excellent), risques = 0/10 (mauvais) dans FULL_COVERAGE_INPUT
    const prioriseDemographie = computeCityScore(FULL_COVERAGE_INPUT, { demographie: "important" });
    const priorisesRisques = computeCityScore(FULL_COVERAGE_INPUT, { risques: "important" });
    expect(prioriseDemographie.score!).toBeGreaterThan(priorisesRisques.score!);
  });

  it("une priorité sur un axe sans donnée disponible n'a aucun effet (l'axe reste absent)", () => {
    const result = computeCityScore(EMPTY_INPUT, { demographie: "important" });
    expect(result.axes).toHaveLength(0);
    expect(result.score).toBeNull();
  });
});
