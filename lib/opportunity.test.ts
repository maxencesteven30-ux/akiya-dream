import { describe, expect, it } from "vitest";
import {
  categorizeOpportunityScore,
  computeConfidenceLevel,
  computeOpportunityScore,
  getOpportunityHeadline,
  type OpportunityInput,
} from "@/lib/opportunity";
import type { RealListing, Region } from "@/lib/types";

const REGION: Region = {
  prefecture: "Fukuoka_Periph",
  medianPriceJpy: 4_000_000,
  medianAgeYears: 35,
  pre1981Percent: 30,
  subsidyMaxJpy: 0,
  recommendationLevel: "B",
};

const REGION_HIGH_PRE1981: Region = {
  prefecture: "Shimane",
  medianPriceJpy: 3_000_000,
  medianAgeYears: 50,
  pre1981Percent: 70,
  subsidyMaxJpy: 0,
  recommendationLevel: "C",
};

const EMPTY_LISTING: RealListing = {
  name: "Test",
  city: "Test",
  surfaceM2: null,
  landM2: null,
  constructionYear: null,
  stationDistanceKm: null,
  condition: "unknown",
};

function baseInput(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  return {
    prixAchatJpy: 4_000_000,
    profile: "solo",
    renovationLevel: "standard",
    region: REGION,
    listing: EMPTY_LISTING,
    ...overrides,
  };
}

describe("categorizeOpportunityScore", () => {
  it("respecte les bornes exactes des catégories", () => {
    expect(categorizeOpportunityScore(0)).toBe("faible");
    expect(categorizeOpportunityScore(2.9)).toBe("faible");
    expect(categorizeOpportunityScore(3)).toBe("risquee");
    expect(categorizeOpportunityScore(4.9)).toBe("risquee");
    expect(categorizeOpportunityScore(5)).toBe("interessante");
    expect(categorizeOpportunityScore(6.9)).toBe("interessante");
    expect(categorizeOpportunityScore(7)).toBe("bonne");
    expect(categorizeOpportunityScore(8.4)).toBe("bonne");
    expect(categorizeOpportunityScore(8.5)).toBe("tres_bonne");
    expect(categorizeOpportunityScore(10)).toBe("tres_bonne");
  });
});

describe("getOpportunityHeadline", () => {
  it("n'affirme jamais une opportunité positive pour les catégories faible/risquée", () => {
    expect(getOpportunityHeadline("faible")).not.toContain("intéressante");
    expect(getOpportunityHeadline("risquee")).not.toContain("intéressante");
  });

  it("utilise le message positif pour les catégories interessante/bonne/tres_bonne", () => {
    expect(getOpportunityHeadline("interessante")).toContain("intéressante");
    expect(getOpportunityHeadline("bonne")).toContain("intéressante");
    expect(getOpportunityHeadline("tres_bonne")).toContain("intéressante");
  });
});

describe("computeConfidenceLevel", () => {
  it("faible avec 0 ou 1 signal", () => {
    expect(
      computeConfidenceLevel({
        hasConstructionYear: false,
        hasSurfaceM2: false,
        hasCondition: false,
        hasRegion: false,
      }),
    ).toBe("low");
    expect(
      computeConfidenceLevel({
        hasConstructionYear: true,
        hasSurfaceM2: false,
        hasCondition: false,
        hasRegion: false,
      }),
    ).toBe("low");
  });

  it("moyenne avec 2 ou 3 signaux (ex. année + état)", () => {
    expect(
      computeConfidenceLevel({
        hasConstructionYear: true,
        hasSurfaceM2: false,
        hasCondition: true,
        hasRegion: false,
      }),
    ).toBe("medium");
  });

  it("élevée avec les 4 signaux", () => {
    expect(
      computeConfidenceLevel({
        hasConstructionYear: true,
        hasSurfaceM2: true,
        hasCondition: true,
        hasRegion: true,
      }),
    ).toBe("high");
  });
});

describe("computeOpportunityScore", () => {
  it("Test 1 — récente + bon état + prix attractif -> score élevé", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 2_500_000,
        listing: { ...EMPTY_LISTING, constructionYear: 2015, surfaceM2: 80, condition: "good" },
      }),
    );
    expect(result.score).toBeGreaterThan(7);
    expect(["bonne", "tres_bonne"]).toContain(result.category);
  });

  it("Test 2 — très ancienne + mauvais état + prix très bas -> score pénalisé malgré le prix", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 500_000,
        listing: {
          ...EMPTY_LISTING,
          constructionYear: 1965,
          surfaceM2: 100,
          condition: "major_renovation",
        },
      }),
    );
    // Le prix très bas ne doit pas suffire à sauver la note : anti-piège "prix bas = bonne affaire"
    expect(result.score).toBeLessThan(6);
  });

  it("Test 3 — ancienne + bon état + prix moyen -> score intermédiaire", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 4_000_000,
        listing: { ...EMPTY_LISTING, constructionYear: 1970, surfaceM2: 80, condition: "good" },
      }),
    );
    expect(result.score).toBeGreaterThan(3);
    expect(result.score).toBeLessThan(8.5);
  });

  it("Test 4 — prix élevé + peu de travaux : pénalisé sur Prix mais pas sur Travaux", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 8_000_000, // 2x la médiane régionale
        listing: { ...EMPTY_LISTING, constructionYear: 2010, surfaceM2: 60, condition: "good" },
      }),
    );
    const prix = result.subScores.find((s) => s.key === "prix")!;
    const travaux = result.subScores.find((s) => s.key === "travaux")!;
    expect(prix.score).toBeLessThan(2);
    expect(travaux.score).toBeGreaterThan(8);
  });

  it("Test 5 — prix bas + travaux extrêmement élevés -> Travaux proche de 0", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 1_000_000,
        listing: { ...EMPTY_LISTING, constructionYear: 1965, surfaceM2: 200, condition: "unknown" },
      }),
    );
    const travaux = result.subScores.find((s) => s.key === "travaux")!;
    expect(travaux.score).toBeLessThanOrEqual(1);
  });

  it("Test 6 — surface inconnue : Travaux bascule sur le forfait par niveau, reste calculable", () => {
    const result = computeOpportunityScore(
      baseInput({
        renovationLevel: "standard",
        listing: { ...EMPTY_LISTING, constructionYear: 2005, surfaceM2: null, condition: "good" },
      }),
    );
    const travaux = result.subScores.find((s) => s.key === "travaux")!;
    expect(travaux).toBeDefined();
    expect(result.budget.surfaceBasedRenovation).toBeNull();
    expect(Number.isNaN(travaux.score)).toBe(false);
  });

  it("Test 7 — année inconnue : Ancienneté bascule sur le taux régional pré-1981", () => {
    const result = computeOpportunityScore(
      baseInput({
        region: REGION_HIGH_PRE1981,
        listing: { ...EMPTY_LISTING, constructionYear: null, surfaceM2: 80, condition: "fair" },
      }),
    );
    const anciennete = result.subScores.find((s) => s.key === "anciennete")!;
    expect(anciennete).toBeDefined();
    expect(anciennete.justification).toContain("inconnue");
  });

  it("Test 8 — état inconnu : sous-score État exclu, poids redistribué (jamais 5 par défaut)", () => {
    const result = computeOpportunityScore(
      baseInput({
        listing: { ...EMPTY_LISTING, constructionYear: 2005, surfaceM2: 80, condition: "unknown" },
      }),
    );
    expect(result.subScores.some((s) => s.key === "etat")).toBe(false);
    expect(result.coverageIncomplete).toBe(true);
  });

  it("Test 9 — région/référence absente : Prix exclu, poids redistribué", () => {
    const result = computeOpportunityScore(
      baseInput({
        region: null,
        listing: { ...EMPTY_LISTING, constructionYear: null, surfaceM2: 80, condition: "good" },
      }),
    );
    expect(result.subScores.some((s) => s.key === "prix")).toBe(false);
    expect(result.subScores.some((s) => s.key === "anciennete")).toBe(false);
    expect(result.subScores.length).toBe(2); // travaux + état uniquement
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it("Test 10 — cohérence avec les scénarios optimiste/réaliste/prudent", () => {
    const result = computeOpportunityScore(
      baseInput({
        listing: { ...EMPTY_LISTING, constructionYear: 1975, surfaceM2: 80, condition: "fair" },
      }),
    );
    expect(result.scenarios).toHaveLength(3);
    const realiste = result.scenarios.find((s) => s.label === "realiste")!;
    const optimiste = result.scenarios.find((s) => s.label === "optimiste")!;
    expect(realiste.travauxJpy).toBeCloseTo(optimiste.travauxJpy * 1.1, 6);
  });

  it("Test 11 — score toujours borné entre 0 et 10 (cas extrêmes)", () => {
    const veryExpensive = computeOpportunityScore(
      baseInput({ prixAchatJpy: 100_000_000 }),
    );
    const veryCheap = computeOpportunityScore(baseInput({ prixAchatJpy: 1 }));
    expect(veryExpensive.score).toBeGreaterThanOrEqual(0);
    expect(veryExpensive.score).toBeLessThanOrEqual(10);
    expect(veryCheap.score).toBeGreaterThanOrEqual(0);
    expect(veryCheap.score).toBeLessThanOrEqual(10);
  });

  it("Test 12 — aucune division par zéro même avec un seul critère disponible", () => {
    const result = computeOpportunityScore(
      baseInput({
        region: null,
        listing: { ...EMPTY_LISTING, constructionYear: null, surfaceM2: null, condition: "unknown" },
      }),
    );
    expect(result.subScores.length).toBe(1); // travaux uniquement
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("Test 13 — aucun NaN sur toute combinaison de données manquantes", () => {
    const result = computeOpportunityScore(
      baseInput({
        region: null,
        listing: EMPTY_LISTING,
      }),
    );
    expect(Number.isNaN(result.score)).toBe(false);
    for (const s of result.subScores) {
      expect(Number.isNaN(s.score)).toBe(false);
    }
  });

  it("Test 14 — déterministe : deux appels identiques donnent un résultat strictement identique", () => {
    const input = baseInput({
      listing: { ...EMPTY_LISTING, constructionYear: 1990, surfaceM2: 90, condition: "fair" },
    });
    const a = computeOpportunityScore(input);
    const b = computeOpportunityScore(input);
    expect(a.score).toBe(b.score);
    expect(a.category).toBe(b.category);
    expect(a.confidence).toBe(b.confidence);
    expect(a.subScores).toEqual(b.subScores);
  });

  it("Test — la précision affichée reste à 1 décimale", () => {
    const result = computeOpportunityScore(
      baseInput({
        listing: { ...EMPTY_LISTING, constructionYear: 1990, surfaceM2: 90, condition: "fair" },
      }),
    );
    expect(result.score).toBe(Math.round(result.score * 10) / 10);
  });

  it("Test — confiance distincte du score (bonne note mais confiance faible possible)", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 2_000_000,
        region: null,
        listing: { ...EMPTY_LISTING, constructionYear: 2015, surfaceM2: null, condition: "unknown" },
      }),
    );
    expect(result.confidence).toBe("low");
  });
});
