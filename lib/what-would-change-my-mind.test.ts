import { describe, expect, it } from "vitest";
import { createEmptyChecklist, computeCompletionSummary } from "@/lib/due-diligence";
import { REALITY_GATE_TEMPLATE, RECONSTRUCTION_ITEM_ID } from "@/lib/reality-gate";
import { buildNextActionSignals, type NextActionInput } from "@/lib/next-best-action";
import { computeWhatWouldChangeMyMind } from "@/lib/what-would-change-my-mind";
import type { RealityGateState } from "@/lib/types";

function cleanRealityGate(): RealityGateState {
  return Object.fromEntries(REALITY_GATE_TEMPLATE.map((item) => [item.id, "verifie"]));
}

const fullCompletion = { completed: 29, total: 29, percent: 100, hasProblem: false };

const readyInput: NextActionInput = {
  realityGate: cleanRealityGate(),
  landNature: "residentiel",
  dueDiligence: {},
  completion: fullCompletion,
  feasibility: "compatible",
  visitStatus: "terminee",
  documentsCount: 5,
};

describe("computeWhatWouldChangeMyMind", () => {
  it("renvoie un tableau vide quand rien ne pourrait changer le verdict (projet prêt)", () => {
    const signals = buildNextActionSignals(readyInput);
    expect(computeWhatWouldChangeMyMind(signals)).toEqual([]);
  });

  it("place le droit de reconstruire non confirmé en tête, avec un pourquoi explicite", () => {
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "a_confirmer" as const };
    const signals = buildNextActionSignals({ ...readyInput, realityGate });
    const factors = computeWhatWouldChangeMyMind(signals);
    expect(factors[0].rank).toBe(1);
    expect(factors[0].level).toBe("CRITICAL_UNKNOWN");
    expect(factors[0].why).toMatch(/inconnue/i);
  });

  it("ne renvoie jamais plus de 3 facteurs même si de nombreux signaux sont actifs", () => {
    const dueDiligence = createEmptyChecklist();
    const signals = buildNextActionSignals({
      ...readyInput,
      landNature: null,
      dueDiligence,
      completion: computeCompletionSummary(dueDiligence),
      feasibility: "tendu",
      visitStatus: "non_commencee",
      documentsCount: 0,
    });
    expect(signals.length).toBeGreaterThan(3);
    const factors = computeWhatWouldChangeMyMind(signals);
    expect(factors).toHaveLength(3);
    expect(factors.map((f) => f.rank)).toEqual([1, 2, 3]);
  });

  it("ne contient jamais de chiffre de probabilité inventé dans le texte du pourquoi", () => {
    const dueDiligence = createEmptyChecklist();
    const signals = buildNextActionSignals({
      ...readyInput,
      landNature: null,
      dueDiligence,
      completion: computeCompletionSummary(dueDiligence),
    });
    const factors = computeWhatWouldChangeMyMind(signals);
    for (const factor of factors) {
      expect(factor.why).not.toMatch(/%|chances?\s+de\s+\d/i);
    }
  });
});
