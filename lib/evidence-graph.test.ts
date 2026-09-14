import { describe, expect, it } from "vitest";
import { REALITY_GATE_TEMPLATE, RECONSTRUCTION_ITEM_ID } from "@/lib/reality-gate";
import { createEmptyChecklist, computeCompletionSummary } from "@/lib/due-diligence";
import type { NextActionInput } from "@/lib/next-best-action";
import { classifyFieldProvenance, computeEvidenceGraph, explainSignal } from "@/lib/evidence-graph";
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

describe("classifyFieldProvenance", () => {
  it("classe les champs déclaratifs de l'utilisateur en USER_INPUT", () => {
    expect(classifyFieldProvenance("realityGate.reconstruction_droit")).toBe("USER_INPUT");
    expect(classifyFieldProvenance("dueDiligence.batiment_toiture")).toBe("USER_INPUT");
    expect(classifyFieldProvenance("landNature")).toBe("USER_INPUT");
  });

  it("classe une valeur calculée en DERIVED_VALUE, jamais en FACT externe", () => {
    expect(classifyFieldProvenance("completion.percent")).toBe("DERIVED_VALUE");
    expect(classifyFieldProvenance("budget.acquisitionJpy")).toBe("DERIVED_VALUE");
  });

  it("classe une hypothèse de niveau de travaux en ESTIMATE, jamais en FACT", () => {
    expect(classifyFieldProvenance("budget.travauxJpy")).toBe("ESTIMATE");
  });

  it("classe un taux sourcé externe en EXTERNAL_FACT", () => {
    expect(classifyFieldProvenance("fxRate")).toBe("EXTERNAL_FACT");
  });

  it("un champ non reconnu reste UNKNOWN, jamais une provenance devinée", () => {
    expect(classifyFieldProvenance("champInexistant")).toBe("UNKNOWN");
  });
});

describe("explainSignal", () => {
  it("expose la règle exacte et les champs utilisés, jamais une boîte noire", () => {
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "probleme" as const };
    const [top] = computeEvidenceGraph({ ...readyInput, realityGate });
    expect(top.ruleId).toBeTruthy();
    expect(top.facts.length).toBeGreaterThan(0);
    expect(top.facts[0].fieldPath).toMatch(/realityGate/);
  });

  it("le total prix affiché n'est jamais présenté comme un FACT externe : c'est une DERIVED_VALUE", () => {
    const node = explainSignal({
      level: "MISSING_INFO",
      message: "Test",
      reason: { ruleId: "test", message: "Test", fieldsUsed: ["budget.acquisitionJpy", "budget.travauxJpy"] },
    });
    expect(node.facts[0].provenance).toBe("DERIVED_VALUE");
    expect(node.facts[1].provenance).toBe("ESTIMATE");
  });
});

describe("computeEvidenceGraph", () => {
  it("produit un nœud explicable par signal actif, dans l'ordre de priorité", () => {
    const dueDiligence = createEmptyChecklist();
    const graph = computeEvidenceGraph({
      ...readyInput,
      landNature: null,
      dueDiligence,
      completion: computeCompletionSummary(dueDiligence),
    });
    expect(graph[0].verdict).toBe("CRITICAL_UNKNOWN");
    expect(graph.some((n) => n.verdict === "MISSING_INFO")).toBe(true);
  });

  it("tableau vide quand le projet est prêt — aucun nœud à expliquer, jamais un faux positif", () => {
    expect(computeEvidenceGraph(readyInput)).toEqual([]);
  });
});
