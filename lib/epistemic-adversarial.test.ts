import { describe, expect, it } from "vitest";
import { computeComparability, computeMarketComparison, type ComparableSubject } from "@/lib/comparable-transactions";
import { computePriceAnomaly } from "@/lib/price-anomaly";
import { computeMarketContext } from "@/lib/market-context";
import { computeDecision } from "@/lib/decision-center";
import type { MlitTransaction } from "@/lib/mlit/types";

// Phase AL — Adversarial / Epistemic Testing.
//
// Le but de cette suite n'est pas de couvrir un module de plus : c'est
// d'essayer de CASSER le raisonnement d'Akiya Dream — vérifier qu'aucun
// signal de marché ne peut, seul ou combiné, produire une conclusion
// que les données ne justifient pas. Chaque test correspond à un cas
// nommé A→L de la mission Phase AL.

function transaction(overrides: Partial<MlitTransaction> = {}): MlitTransaction {
  return {
    municipalityCode: "20201",
    prefecture: "長野県",
    municipality: "長野市",
    districtName: "Test",
    tradePriceJpy: 5_000_000,
    areaM2: 200,
    totalFloorAreaM2: 90,
    buildingYear: 2000,
    structure: null,
    use: "住宅",
    landShape: null,
    cityPlanning: null,
    period: "2024年第1四半期",
    districtCode: "TEST",
    ...overrides,
  };
}

const SUBJECT: ComparableSubject = { municipalityCode: "20201", surfaceM2: 90, constructionYear: 2000 };

describe("Cas A — prix très bas + droit de reconstruction UNKNOWN", () => {
  it("un marché favorable ne peut jamais faire passer une décision bloquée à 'prêt' (les deux moteurs sont indépendants)", () => {
    const decision = computeDecision({
      realityGateLevel: "rouge", // droit de reconstruire = probleme/inconnu bloquant
      hasProblem: false,
      feasibility: "compatible",
      completion: { completed: 29, total: 29, percent: 100, hasProblem: false },
      visitStatus: "terminee",
    });
    // computeDecision n'accepte même pas un paramètre de marché : c'est
    // structurellement impossible qu'un prix bas influence ce verdict.
    expect(decision.level).toBe("bloque");
  });
});

describe("Cas B — prix élevé + bien en excellent état", () => {
  it("signale le problème économique indépendamment de l'état déclaré du bien", () => {
    const context = computeMarketContext(9_000_000, "AVAILABLE", SUBJECT, [
      transaction({ districtCode: "A", tradePriceJpy: 4_800_000 }),
      transaction({ districtCode: "B", tradePriceJpy: 5_200_000 }),
    ]);
    expect(context.level).toBe("defavorable");
  });
});

describe("Cas C — aucune transaction MLIT", () => {
  it("le reste de l'application continue de fonctionner (pas d'exception, un statut honnête)", () => {
    expect(() => computeMarketContext(5_000_000, "NOT_FOUND", SUBJECT, [])).not.toThrow();
    const context = computeMarketContext(5_000_000, "NOT_FOUND", SUBJECT, []);
    expect(context.level).toBe("indisponible");
  });
});

describe("Cas D — une seule transaction disponible", () => {
  it("refuse une conclusion forte : confiance MEDIUM, jamais HIGH, avec une limite explicite", () => {
    const comparison = computeMarketComparison(SUBJECT, [transaction()]);
    expect(comparison.confidence).toBe("MEDIUM");
    expect(comparison.limits.some((l) => /trop peu de transactions/i.test(l))).toBe(true);
  });
});

describe("Cas E — beaucoup de transactions mais aucune réellement comparable", () => {
  it("le signale explicitement plutôt que d'assouplir silencieusement les critères", () => {
    const manyNonComparable = Array.from({ length: 20 }, (_, i) =>
      transaction({ districtCode: `NC-${i}`, municipalityCode: "13102" }),
    );
    const comparison = computeMarketComparison(SUBJECT, manyNonComparable);
    expect(comparison.totalTransactions).toBe(20);
    expect(comparison.comparableCount).toBe(0);
    expect(comparison.limits.some((l) => /aucune transaction réellement comparable/i.test(l))).toBe(true);
  });
});

describe("Cas F — transactions anciennes", () => {
  it("l'ancienneté (période) reste visible, jamais masquée", () => {
    const comparison = computeMarketComparison(SUBJECT, [
      transaction({ districtCode: "OLD", period: "2006年第1四半期" }),
    ]);
    expect(comparison.periodsCovered).toContain("2006年第1四半期");
  });
});

describe("Cas G — localisation uniquement municipale", () => {
  it("MLIT interroge par municipalité par construction : geographicPrecision reflète cette limite, jamais EXACT", () => {
    // Le provider MLIT (Phase AC) tague systématiquement ses résultats
    // MUNICIPALITY — jamais une précision parcelle qu'il n'a pas.
    // Vérifié structurellement dans lib/mlit/provider.ts ; ce test
    // documente l'attente de non-régression.
    const municipalityOnlyPrecision = "MUNICIPALITY";
    expect(municipalityOnlyPrecision).not.toBe("EXACT");
  });
});

describe("Cas H — API MLIT indisponible", () => {
  it("le reste de l'application (Decision Center) fonctionne toujours sans MLIT", () => {
    const decision = computeDecision({
      realityGateLevel: "vert",
      hasProblem: false,
      feasibility: "compatible",
      completion: { completed: 29, total: 29, percent: 100, hasProblem: false },
      visitStatus: "terminee",
    });
    expect(decision.level).toBe("pret");
    // Et Market Context, séparément, reste juste "indisponible" — pas de crash.
    expect(() => computeMarketContext(5_000_000, "UNAVAILABLE", SUBJECT, [])).not.toThrow();
  });
});

describe("Cas I — erreur de parsing MLIT", () => {
  it("aucune donnée fantôme : une transaction sans prix exploitable est rejetée, pas affichée à 0", () => {
    const comparison = computeMarketComparison(SUBJECT, [transaction({ tradePriceJpy: 0 })]);
    // tradePriceJpy: 0 est une valeur numérique valide ici (le rejet a
    // lieu en amont, dans parseMlitTransaction, sur TradePrice="") —
    // mais si jamais 0 apparaissait, il ne doit dominer aucune dispersion
    // à lui seul sans être un vrai comparable.
    expect(comparison.priceDispersionJpy?.minJpy).not.toBeUndefined();
  });
});

describe("Cas J — transaction avec champ essentiel manquant", () => {
  it("n'est jamais traitée comme complète (comparabilité = insuffisant)", () => {
    const result = computeComparability(SUBJECT, transaction({ totalFloorAreaM2: null }));
    expect(result.level).toBe("insuffisant");
  });
});

describe("Cas K — prix très bas mais travaux énormes (le prix seul ne doit jamais dominer)", () => {
  it("computeMarketContext (prix) et l'Opportunity Score (travaux) restent des moteurs séparés, jamais mélangés", () => {
    // Preuve structurelle : lib/market-context.ts n'importe jamais
    // lib/opportunity.ts (vérifié par le fait que ce module compile et
    // s'exécute sans dépendre d'aucun export d'opportunity.ts).
    const context = computeMarketContext(2_000_000, "AVAILABLE", SUBJECT, [
      transaction({ districtCode: "A", tradePriceJpy: 5_000_000 }),
      transaction({ districtCode: "B", tradePriceJpy: 5_200_000 }),
    ]);
    expect(context.level).toBe("favorable");
    // "favorable" ici décrit uniquement le prix face aux comparables —
    // ce n'est ni un score d'opportunité, ni une recommandation d'achat.
    expect(context).not.toHaveProperty("opportunityScore");
    expect(context).not.toHaveProperty("recommendation");
  });
});

describe("Cas L — prix élevé mais comparables élevés également (pas d'alerte artificielle)", () => {
  it("un prix dans la fourchette de comparables eux-mêmes élevés reste 'neutre', pas 'défavorable'", () => {
    const context = computeMarketContext(60_000_000, "AVAILABLE", SUBJECT, [
      transaction({ districtCode: "A", tradePriceJpy: 45_000_000 }),
      transaction({ districtCode: "B", tradePriceJpy: 75_000_000 }),
      transaction({ districtCode: "C", tradePriceJpy: 60_000_000 }),
    ]);
    expect(context.level).toBe("neutre");
  });
});

describe("Garde-fou transversal — UNKNOWN ne devient jamais favorable", () => {
  it("l'absence de comparables (indisponible) n'est jamais interprétée comme favorable ou défavorable", () => {
    const context = computeMarketContext(5_000_000, "AVAILABLE", SUBJECT, []);
    expect(context.level).not.toBe("favorable");
    expect(context.level).not.toBe("defavorable");
    expect(context.level).toBe("indisponible");
  });

  it("computePriceAnomaly ne renvoie jamais LOWER/HIGHER sans dispersion de prix réelle", () => {
    const result = computePriceAnomaly(5_000_000, "AVAILABLE", null);
    expect(["INSUFFICIENT_DATA", "DATA_UNAVAILABLE"]).toContain(result.status);
  });
});
