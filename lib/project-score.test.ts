import { describe, expect, it } from "vitest";
import { computeProjectVerdict, computeRiskLevel } from "@/lib/project-score";
import type { CompletionSummary } from "@/lib/due-diligence";
import type { RiskFlag } from "@/lib/calculations";

const NO_FLAGS: RiskFlag[] = [];
const SOME_FLAGS: RiskFlag[] = [{ key: "test", message: "test" }];

function completion(percent: number): CompletionSummary {
  return { completed: percent, total: 100, percent, hasProblem: false };
}

describe("computeRiskLevel", () => {
  it("est élevé si un problème de due diligence est détecté, quelle que soit la faisabilité", () => {
    expect(
      computeRiskLevel({ hasProblem: true, feasibility: "compatible", riskFlags: NO_FLAGS }),
    ).toBe("eleve");
  });

  it("est élevé si le budget est insuffisant, même sans problème de dossier", () => {
    expect(
      computeRiskLevel({ hasProblem: false, feasibility: "insuffisant", riskFlags: NO_FLAGS }),
    ).toBe("eleve");
  });

  it("est modéré si des signaux de vigilance existent sans blocage confirmé", () => {
    expect(
      computeRiskLevel({ hasProblem: false, feasibility: "compatible", riskFlags: SOME_FLAGS }),
    ).toBe("moyen");
  });

  it("est modéré si le budget est seulement tendu", () => {
    expect(
      computeRiskLevel({ hasProblem: false, feasibility: "tendu", riskFlags: NO_FLAGS }),
    ).toBe("moyen");
  });

  it("est faible sans problème, sans signal, et un budget compatible", () => {
    expect(
      computeRiskLevel({ hasProblem: false, feasibility: "compatible", riskFlags: NO_FLAGS }),
    ).toBe("faible");
  });

  it("est faible si la faisabilité est inconnue (pas de budget personnel renseigné) et aucun autre signal", () => {
    expect(computeRiskLevel({ hasProblem: false, feasibility: null, riskFlags: NO_FLAGS })).toBe(
      "faible",
    );
  });
});

describe("computeProjectVerdict", () => {
  it("priorise toujours le risque élevé, même pour une très bonne opportunité", () => {
    const verdict = computeProjectVerdict({
      opportunityCategory: "tres_bonne",
      risk: "eleve",
      completion: completion(100),
    });
    expect(verdict.level).toBe("rouge");
  });

  it("reprend l'exemple du cahier des charges : bonne opportunité mais dossier incomplet", () => {
    const verdict = computeProjectVerdict({
      opportunityCategory: "bonne",
      risk: "faible",
      completion: completion(40),
    });
    expect(verdict.level).toBe("vert");
    expect(verdict.message).toBe("Projet intéressant mais encore insuffisamment documenté.");
  });

  it("bonne opportunité et dossier documenté donne un message différent", () => {
    const verdict = computeProjectVerdict({
      opportunityCategory: "bonne",
      risk: "faible",
      completion: completion(85),
    });
    expect(verdict.level).toBe("vert");
    expect(verdict.message).toBe("Projet intéressant et bien documenté.");
  });

  it("potentiel intéressant avec risque modéré donne un verdict orange", () => {
    const verdict = computeProjectVerdict({
      opportunityCategory: "interessante",
      risk: "moyen",
      completion: completion(50),
    });
    expect(verdict.level).toBe("orange");
  });

  it("potentiel intéressant sans risque donne un verdict jaune", () => {
    const verdict = computeProjectVerdict({
      opportunityCategory: "interessante",
      risk: "faible",
      completion: completion(50),
    });
    expect(verdict.level).toBe("jaune");
  });

  it("opportunité risquée donne un verdict orange", () => {
    const verdict = computeProjectVerdict({
      opportunityCategory: "risquee",
      risk: "faible",
      completion: completion(50),
    });
    expect(verdict.level).toBe("orange");
  });

  it("opportunité faible donne un verdict rouge", () => {
    const verdict = computeProjectVerdict({
      opportunityCategory: "faible",
      risk: "faible",
      completion: completion(50),
    });
    expect(verdict.level).toBe("rouge");
  });
});
