import { describe, expect, it } from "vitest";
import { computeRiskLevel } from "@/lib/project-score";
import type { RiskFlag } from "@/lib/calculations";

const NO_FLAGS: RiskFlag[] = [];
const SOME_FLAGS: RiskFlag[] = [{ key: "test", message: "test" }];

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
