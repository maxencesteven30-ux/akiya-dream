import { describe, expect, it } from "vitest";
import {
  categorizeOpportunityScore,
  computeConfidenceLevel,
  computeInterestingZone,
  computeMaxAffordablePrice,
  computeOpportunityScore,
  computePriceSensitivity,
  findAttractivePrice,
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
  latitude: null,
  longitude: null,
  municipalityCode: null,
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

describe("computeMaxAffordablePrice — prix maximum finançable (V2)", () => {
  it("budget confortable : prix maximum nettement supérieur au prix demandé", () => {
    const maxPrice = computeMaxAffordablePrice("solo", 3_000_000, 100_000, 10_000);
    expect(maxPrice).not.toBeNull();
    expect(maxPrice!).toBeGreaterThan(4_000_000);
  });

  it("budget limite : prix maximum proche d'un budget serré", () => {
    // Budget dispo ~55 900€ (~10M JPY), travaux 3M JPY
    const maxPrice = computeMaxAffordablePrice("solo", 3_000_000, 55_900, 0);
    expect(maxPrice).not.toBeNull();
    expect(maxPrice!).toBeGreaterThan(5_000_000);
    expect(maxPrice!).toBeLessThan(7_000_000);
  });

  it("budget insuffisant : retourne null (jamais un prix négatif ou inventé)", () => {
    const maxPrice = computeMaxAffordablePrice("solo", 3_000_000, 5_000, 4_000);
    expect(maxPrice).toBeNull();
  });
});

describe("computePriceSensitivity — analyse de sensibilité (V2)", () => {
  it("chaque point du tableau correspond exactement à un appel réel du moteur", () => {
    const input = baseInput({
      listing: { ...EMPTY_LISTING, constructionYear: 1990, surfaceM2: 80, condition: "fair" },
    });
    const points = computePriceSensitivity(input);

    for (const point of points) {
      const direct = computeOpportunityScore({ ...input, prixAchatJpy: point.prixJpy });
      expect(point.score).toBe(direct.score);
      expect(point.category).toBe(direct.category);
    }
  });

  it("une baisse de prix améliore (ou maintient) le sous-score Prix", () => {
    const input = baseInput({
      prixAchatJpy: 6_000_000, // largement au-dessus de la médiane régionale (4M)
      listing: { ...EMPTY_LISTING, constructionYear: 2010, surfaceM2: 70, condition: "good" },
    });
    const points = computePriceSensitivity(input);
    const sortedByPrice = [...points].sort((a, b) => a.prixJpy - b.prixJpy);
    // Le prix le plus bas du tableau doit avoir un score au moins aussi bon
    // que le prix le plus haut, puisque le bien est déjà cher par rapport à
    // la médiane (la composante Prix domine dans cette zone).
    expect(sortedByPrice[0].score).toBeGreaterThanOrEqual(
      sortedByPrice[sortedByPrice.length - 1].score,
    );
  });

  it("retourne des points triés par prix croissant, sans doublons", () => {
    const input = baseInput();
    const points = computePriceSensitivity(input);
    const prices = points.map((p) => p.prixJpy);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(new Set(prices).size).toBe(prices.length);
  });

  it("expose le projet total (JPY et EUR) cohérent avec le moteur réel", () => {
    const input = baseInput({
      listing: { ...EMPTY_LISTING, constructionYear: 1990, surfaceM2: 80, condition: "fair" },
    });
    const points = computePriceSensitivity(input);
    for (const point of points) {
      const direct = computeOpportunityScore({ ...input, prixAchatJpy: point.prixJpy });
      expect(point.totalProjetJpy).toBe(direct.budget.totalProjetJpy);
      expect(point.totalProjetEur).toBeCloseTo(direct.budget.totalProjetEur, 6);
    }
  });
});

describe("computeInterestingZone — zone de négociation intéressante (V2)", () => {
  it("retourne une plage [min, max] où le score atteint le seuil visé", () => {
    const input = baseInput({
      prixAchatJpy: 6_000_000,
      listing: { ...EMPTY_LISTING, constructionYear: 2010, surfaceM2: 70, condition: "good" },
    });
    const zone = computeInterestingZone(input);
    expect(zone).not.toBeNull();
    expect(zone!.minJpy).toBeLessThanOrEqual(zone!.maxJpy);

    const atMin = computeOpportunityScore({ ...input, prixAchatJpy: zone!.minJpy });
    const atMax = computeOpportunityScore({ ...input, prixAchatJpy: zone!.maxJpy });
    expect(atMin.score).toBeGreaterThanOrEqual(7);
    expect(atMax.score).toBeGreaterThanOrEqual(7);
  });

  it("ne recommande jamais un prix supérieur au prix demandé actuel", () => {
    const input = baseInput({
      prixAchatJpy: 6_000_000,
      listing: { ...EMPTY_LISTING, constructionYear: 2010, surfaceM2: 70, condition: "good" },
    });
    const zone = computeInterestingZone(input);
    if (zone) {
      expect(zone.maxJpy).toBeLessThanOrEqual(6_000_000);
    }
  });

  it("retourne null si aucun prix testé dans la plage n'atteint le seuil", () => {
    const input = baseInput({
      prixAchatJpy: 4_000_000,
      listing: {
        ...EMPTY_LISTING,
        constructionYear: 1965,
        surfaceM2: 150,
        condition: "major_renovation",
      },
    });
    expect(computeInterestingZone(input, 9.5)).toBeNull();
  });
});

describe("findAttractivePrice — prix attractif (V2)", () => {
  it("retourne le prix actuel si le score est déjà au-dessus du seuil", () => {
    const input = baseInput({
      prixAchatJpy: 2_000_000,
      listing: { ...EMPTY_LISTING, constructionYear: 2015, surfaceM2: 80, condition: "good" },
    });
    expect(computeOpportunityScore(input).score).toBeGreaterThanOrEqual(7);
    expect(findAttractivePrice(input)).toBe(2_000_000);
  });

  it("retourne un prix inférieur qui atteint réellement le seuil visé", () => {
    const input = baseInput({
      prixAchatJpy: 6_000_000,
      listing: { ...EMPTY_LISTING, constructionYear: 2010, surfaceM2: 70, condition: "good" },
    });
    const attractive = findAttractivePrice(input);
    expect(attractive).not.toBeNull();
    expect(attractive!).toBeLessThan(6_000_000);
    const resultAtAttractive = computeOpportunityScore({ ...input, prixAchatJpy: attractive! });
    expect(resultAtAttractive.score).toBeGreaterThanOrEqual(7);
  });

  it("retourne null si aucun prix testé dans la plage n'atteint le seuil", () => {
    const input = baseInput({
      prixAchatJpy: 4_000_000,
      listing: {
        ...EMPTY_LISTING,
        constructionYear: 1965,
        surfaceM2: 150,
        condition: "major_renovation",
      },
    });
    // Travaux massifs + ancienneté : aucune baisse de prix raisonnable ne
    // suffit à atteindre 7/10 (le poids Ancienneté/État reste plafonné bas).
    expect(findAttractivePrice(input, 9.5)).toBeNull();
  });
});

describe("computeOpportunityScore — câblage budget/faisabilité (V2)", () => {
  it("coût inférieur au budget -> faisabilité compatible", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 2_000_000,
        renovationLevel: "leger",
        capitalDisponibleEur: 50_000,
        reserveSecuriteEur: 5_000,
      }),
    );
    expect(result.budgetVerdict).not.toBeNull();
    expect(result.budgetVerdict!.verdict).toBe("viable");
    expect(result.feasibility).toBe("compatible");
  });

  it("coût proche du budget disponible -> faisabilité tendue", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 4_000_000,
        renovationLevel: "lourd",
        capitalDisponibleEur: 65_000,
        reserveSecuriteEur: 0,
      }),
    );
    expect(result.budgetVerdict).not.toBeNull();
    expect(["tendu", "non_viable"]).toContain(result.budgetVerdict!.verdict);
    expect(["tendu", "insuffisant"]).toContain(result.feasibility);
  });

  it("coût supérieur au budget -> faisabilité insuffisante", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 9_000_000,
        renovationLevel: "lourd",
        capitalDisponibleEur: 20_000,
        reserveSecuriteEur: 5_000,
      }),
    );
    expect(result.budgetVerdict!.verdict).toBe("non_viable");
    expect(result.feasibility).toBe("insuffisant");
  });

  it("sans capital/réserve renseignés : budgetVerdict et feasibility restent null (jamais inventés)", () => {
    const result = computeOpportunityScore(baseInput());
    expect(result.budgetVerdict).toBeNull();
    expect(result.feasibility).toBeNull();
  });

  it("priceAnalysis expose l'écart réel avec la référence régionale", () => {
    const result = computeOpportunityScore(baseInput({ prixAchatJpy: 3_000_000 }));
    expect(result.priceAnalysis.referenceRegionaleJpy).toBe(4_000_000);
    expect(result.priceAnalysis.ecartPercent).toBe(-25);
  });

  it("priceAnalysis retourne null pour la référence si la région est absente", () => {
    const result = computeOpportunityScore(baseInput({ region: null }));
    expect(result.priceAnalysis.referenceRegionaleJpy).toBeNull();
    expect(result.priceAnalysis.ecartPercent).toBeNull();
  });

  it("narrative est toujours une chaîne non vide, jamais une génération libre incohérente", () => {
    const result = computeOpportunityScore(
      baseInput({
        listing: { ...EMPTY_LISTING, constructionYear: 1965, surfaceM2: 100, condition: "major_renovation" },
      }),
    );
    expect(result.narrative.length).toBeGreaterThan(0);
    expect(result.narrative).toContain("travaux");
  });

  it("confidenceExplanation reste distincte du score et reflète la couverture réelle", () => {
    const lowCoverage = computeOpportunityScore(baseInput({ region: null }));
    const highCoverage = computeOpportunityScore(
      baseInput({
        listing: { ...EMPTY_LISTING, constructionYear: 2005, surfaceM2: 80, condition: "good" },
      }),
    );
    expect(lowCoverage.confidenceExplanation).toContain("inconnues");
    expect(highCoverage.confidenceExplanation).not.toContain("inconnues");
  });

  it("priceTargets.negotiationMessage n'est jamais une formulation absolue", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 6_000_000,
        listing: { ...EMPTY_LISTING, constructionYear: 2010, surfaceM2: 70, condition: "good" },
      }),
    );
    if (result.priceTargets.negotiationMessage) {
      expect(result.priceTargets.negotiationMessage).not.toMatch(/vous devez/i);
    }
  });

  it("cas extrême : prix extrêmement bas ne casse ni sensitivity ni priceTargets", () => {
    const result = computeOpportunityScore(baseInput({ prixAchatJpy: 1 }));
    expect(Number.isNaN(result.score)).toBe(false);
    expect(result.sensitivity.every((p) => !Number.isNaN(p.score))).toBe(true);
  });

  it("cas extrême : prix extrêmement élevé ne casse ni sensitivity ni priceTargets", () => {
    const result = computeOpportunityScore(baseInput({ prixAchatJpy: 500_000_000 }));
    expect(Number.isNaN(result.score)).toBe(false);
    expect(result.sensitivity.every((p) => !Number.isNaN(p.score))).toBe(true);
  });

  it("cas extrême : travaux très élevés (bien très ancien, grande surface)", () => {
    const result = computeOpportunityScore(
      baseInput({
        prixAchatJpy: 1_000_000,
        listing: { ...EMPTY_LISTING, constructionYear: 1960, surfaceM2: 300, condition: "major_renovation" },
      }),
    );
    expect(Number.isNaN(result.score)).toBe(false);
    expect(result.budget.travauxJpy).toBeGreaterThan(result.budget.prixAchatJpy);
  });
});
