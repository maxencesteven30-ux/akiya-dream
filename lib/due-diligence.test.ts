import { describe, expect, it } from "vitest";
import {
  CHECKLIST_TEMPLATE,
  computeCompletionSummary,
  computeDueDiligenceVerdict,
  createEmptyChecklist,
  getItemsByCategory,
} from "@/lib/due-diligence";
import type { DueDiligenceState } from "@/lib/types";

describe("CHECKLIST_TEMPLATE", () => {
  it("contient exactement les 29 éléments de la spécification (10+7+6+6)", () => {
    expect(CHECKLIST_TEMPLATE.length).toBe(29);
    expect(getItemsByCategory("batiment")).toHaveLength(10);
    expect(getItemsByCategory("juridique")).toHaveLength(7);
    expect(getItemsByCategory("terrain")).toHaveLength(6);
    expect(getItemsByCategory("vie_locale")).toHaveLength(6);
  });

  it("n'a aucun identifiant dupliqué", () => {
    const ids = CHECKLIST_TEMPLATE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("createEmptyChecklist", () => {
  it("initialise tous les éléments à 'à vérifier'", () => {
    const checklist = createEmptyChecklist();
    expect(Object.keys(checklist)).toHaveLength(29);
    expect(Object.values(checklist).every((status) => status === "a_verifier")).toBe(true);
  });
});

describe("computeCompletionSummary", () => {
  it("retourne 0% pour une checklist vide (tout à vérifier)", () => {
    const summary = computeCompletionSummary(createEmptyChecklist());
    expect(summary.completed).toBe(0);
    expect(summary.percent).toBe(0);
    expect(summary.hasProblem).toBe(false);
  });

  it("retourne 100% quand tout est traité (vérifié ou non applicable)", () => {
    const state: DueDiligenceState = Object.fromEntries(
      CHECKLIST_TEMPLATE.map((item) => [item.id, "verifie"]),
    );
    const summary = computeCompletionSummary(state);
    expect(summary.completed).toBe(29);
    expect(summary.percent).toBe(100);
  });

  it("compte 'non applicable' comme complété, pas comme un problème", () => {
    const state = createEmptyChecklist();
    state["vie_locale_deneigement"] = "non_applicable";
    const summary = computeCompletionSummary(state);
    expect(summary.completed).toBe(1);
    expect(summary.hasProblem).toBe(false);
  });

  it("détecte un problème même isolé", () => {
    const state = createEmptyChecklist();
    state["batiment_termites"] = "probleme";
    const summary = computeCompletionSummary(state);
    expect(summary.hasProblem).toBe(true);
    expect(summary.completed).toBe(1);
  });

  it("ne compte jamais un élément absent du state comme complété", () => {
    const summary = computeCompletionSummary({});
    expect(summary.completed).toBe(0);
    expect(summary.percent).toBe(0);
  });

  it("calcule un pourcentage cohérent pour un état partiel", () => {
    const state = createEmptyChecklist();
    // 10 éléments du bâtiment marqués vérifiés sur 29 au total
    for (const item of getItemsByCategory("batiment")) {
      state[item.id] = "verifie";
    }
    const summary = computeCompletionSummary(state);
    expect(summary.completed).toBe(10);
    expect(summary.percent).toBe(Math.round((10 / 29) * 100));
  });
});

describe("computeDueDiligenceVerdict", () => {
  it("🔴 déconseillé dès qu'un problème est détecté, même avec un dossier presque complet", () => {
    const state: DueDiligenceState = Object.fromEntries(
      CHECKLIST_TEMPLATE.map((item) => [item.id, "verifie"]),
    );
    state["batiment_termites"] = "probleme";
    const summary = computeCompletionSummary(state);
    expect(computeDueDiligenceVerdict(summary)).toBe("deconseille");
  });

  it("🟢 documenté si complétude ≥ 70% et aucun problème", () => {
    const state = createEmptyChecklist();
    for (const item of CHECKLIST_TEMPLATE.slice(0, 21)) {
      state[item.id] = "verifie";
    }
    const summary = computeCompletionSummary(state);
    expect(summary.percent).toBeGreaterThanOrEqual(70);
    expect(computeDueDiligenceVerdict(summary)).toBe("documente");
  });

  it("🟠 incomplet si complétude < 70% et aucun problème", () => {
    const summary = computeCompletionSummary(createEmptyChecklist());
    expect(computeDueDiligenceVerdict(summary)).toBe("incomplet");
  });

  it("est déterministe", () => {
    const state = createEmptyChecklist();
    state["terrain_bornage"] = "probleme";
    const summaryA = computeCompletionSummary(state);
    const summaryB = computeCompletionSummary(state);
    expect(computeDueDiligenceVerdict(summaryA)).toBe(computeDueDiligenceVerdict(summaryB));
  });
});
