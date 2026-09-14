import { describe, expect, it } from "vitest";
import { REALITY_GATE_TEMPLATE, RECONSTRUCTION_ITEM_ID } from "@/lib/reality-gate";
import { createEmptyChecklist, computeCompletionSummary } from "@/lib/due-diligence";
import type { NextActionInput } from "@/lib/next-best-action";
import { classifyFieldProvenance, computeEvidenceGraph, explainCrossSourceContext, explainSignal } from "@/lib/evidence-graph";
import type { CrossSourceContext } from "@/lib/cross-source-context";
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

describe("classifyFieldProvenance — AD.3 (cross-source)", () => {
  it("les données MLIT brutes sont EXTERNAL_FACT, jamais DERIVED_VALUE", () => {
    expect(classifyFieldProvenance("mlitTransactions")).toBe("EXTERNAL_FACT");
    expect(classifyFieldProvenance("landPricePoints")).toBe("EXTERNAL_FACT");
  });

  it("tout ce qu'Akiya Dream calcule à partir de MLIT est DERIVED_VALUE, jamais EXTERNAL_FACT", () => {
    expect(classifyFieldProvenance("marketComparison")).toBe("DERIVED_VALUE");
    expect(classifyFieldProvenance("impliedLandValueJpy")).toBe("DERIVED_VALUE");
    expect(classifyFieldProvenance("medianLandPricePerSqmJpy")).toBe("DERIVED_VALUE");
  });

  it("le prix demandé est USER_INPUT", () => {
    expect(classifyFieldProvenance("askingPriceJpy")).toBe("USER_INPUT");
  });
});

describe("explainCrossSourceContext", () => {
  const context: CrossSourceContext = {
    transactionsAvailable: true,
    landPriceAvailable: true,
    concordance: "SOURCES_CONCORDANT",
    impliedLandValueJpy: 2_000_000,
    medianLandPricePerSqmJpy: 10_000,
    narrative: ["Contexte de marché disponible.", "Prochaine action possible."],
    unknowns: [],
  };

  it("expose le verdict de concordance et une trace complète des champs utilisés", () => {
    const node = explainCrossSourceContext(context);
    expect(node.verdict).toBe("SOURCES_CONCORDANT");
    expect(node.ruleId).toBe("cross_source_concordance");
    expect(node.facts.map((f) => f.fieldPath)).toEqual(
      expect.arrayContaining(["mlitTransactions", "marketComparison", "landPricePoints", "impliedLandValueJpy"]),
    );
  });

  it("chaque fait a une provenance classée, jamais UNKNOWN pour un champ reconnu", () => {
    const node = explainCrossSourceContext(context);
    expect(node.facts.every((f) => f.provenance !== "UNKNOWN")).toBe(true);
  });

  it("n'inclut pas les champs fonciers quand landPriceAvailable est faux", () => {
    const node = explainCrossSourceContext({ ...context, landPriceAvailable: false });
    expect(node.facts.map((f) => f.fieldPath)).not.toContain("landPricePoints");
  });
});
