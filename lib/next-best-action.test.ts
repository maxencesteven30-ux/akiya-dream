import { describe, expect, it } from "vitest";
import { CHECKLIST_TEMPLATE, createEmptyChecklist, computeCompletionSummary } from "@/lib/due-diligence";
import { REALITY_GATE_TEMPLATE, RECONSTRUCTION_ITEM_ID } from "@/lib/reality-gate";
import { buildNextActionSignals, computeNextActionV2, type NextActionInput } from "@/lib/next-best-action";
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

describe("buildNextActionSignals — hiérarchie à 5 niveaux", () => {
  it("un bon score/budget faisable n'empêche pas un signal BLOCKING d'apparaître en tête", () => {
    // "Une bonne note financière ne doit jamais masquer un problème
    // juridique ou technique avéré" — ici le budget est confortable
    // (feasibility compatible) mais un droit de reconstruire est
    // formellement bloqué : le signal BLOCKING doit rester prioritaire.
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "probleme" as const };
    const signals = buildNextActionSignals({ ...readyInput, realityGate });
    expect(signals[0].level).toBe("BLOCKING");
    expect(signals[0].reason.fieldsUsed).toContain(`realityGate.${RECONSTRUCTION_ITEM_ID}`);
  });

  it("une inconnue (reconstruction non confirmée) ne devient jamais un signal favorable", () => {
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "a_confirmer" as const };
    const signals = buildNextActionSignals({ ...readyInput, realityGate });
    expect(signals[0].level).toBe("CRITICAL_UNKNOWN");
    expect(signals[0].message).not.toMatch(/vert|prêt|confirmé/i);
  });

  it("budget faisable + problème juridique de due diligence reste prudent (BLOCKING prime)", () => {
    const dueDiligence = createEmptyChecklist();
    dueDiligence["juridique_acces"] = "probleme";
    const signals = buildNextActionSignals({
      ...readyInput,
      dueDiligence,
      completion: computeCompletionSummary(dueDiligence),
      feasibility: "compatible",
    });
    expect(signals[0].level).toBe("BLOCKING");
    expect(signals[0].reason.ruleId).toMatch(/juridique_acces/);
  });

  it("toutes les données disponibles donnent une réponse complète : prêt pour une offre", () => {
    const action = computeNextActionV2(readyInput);
    expect(action.message).toBe("Projet prêt pour une offre.");
    expect(buildNextActionSignals(readyInput)).toHaveLength(0);
  });

  it("données insuffisantes (dossier vide) : la réponse explicite ce qui manque, sans inventer un verdict", () => {
    const dueDiligence = createEmptyChecklist();
    const action = computeNextActionV2({
      ...readyInput,
      dueDiligence,
      completion: computeCompletionSummary(dueDiligence),
    });
    expect(action.reason).toBe("Dossier encore incomplet");
  });

  it("un conflit (deux problèmes simultanés) reste visible : le plus prioritaire est explicable et traçable", () => {
    const dueDiligence = createEmptyChecklist();
    dueDiligence["batiment_toiture"] = "probleme";
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "probleme" as const };
    const signals = buildNextActionSignals({
      ...readyInput,
      realityGate,
      dueDiligence,
      completion: computeCompletionSummary(dueDiligence),
    });
    // Les deux signaux BLOCKING sont présents (rien n'est écrasé) ...
    expect(signals.filter((s) => s.level === "BLOCKING")).toHaveLength(2);
    // ... mais le Reality Gate (droit de reconstruire) prime sur la due
    // diligence, conformément à l'ordre déjà établi en Phase U.
    expect(signals[0].reason.ruleId).toMatch(/reconstruction_droit/);
  });

  it("respecte l'ordre de priorité global même avec plusieurs signaux de niveaux différents", () => {
    const dueDiligence = createEmptyChecklist();
    const signals = buildNextActionSignals({
      ...readyInput,
      landNature: null, // CRITICAL_UNKNOWN
      dueDiligence,
      completion: computeCompletionSummary(dueDiligence), // MISSING_INFO
      feasibility: "tendu", // DOCUMENTED_RISK
      visitStatus: "non_commencee", // MISSING_INFO
      documentsCount: 0, // MISSING_INFO
    });
    expect(signals.map((s) => s.level)).toEqual([
      "CRITICAL_UNKNOWN",
      "DOCUMENTED_RISK",
      "MISSING_INFO",
      "MISSING_INFO",
      "MISSING_INFO",
    ]);
  });
});

describe("CHECKLIST_TEMPLATE / REALITY_GATE_TEMPLATE cohérence avec le moteur", () => {
  it("chaque item due diligence a un identifiant unique (base des signaux)", () => {
    const ids = CHECKLIST_TEMPLATE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
