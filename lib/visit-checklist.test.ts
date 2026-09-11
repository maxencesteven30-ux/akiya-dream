import { describe, expect, it } from "vitest";
import {
  VISIT_CHECKLIST_TEMPLATE,
  computeVisitProgress,
  createEmptyVisitChecklist,
  getItemsByStage,
} from "@/lib/visit-checklist";

describe("VISIT_CHECKLIST_TEMPLATE", () => {
  it("n'a aucun identifiant dupliqué", () => {
    const ids = VISIT_CHECKLIST_TEMPLATE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("couvre les 3 étapes avant/pendant/après", () => {
    expect(getItemsByStage("avant").length).toBeGreaterThan(0);
    expect(getItemsByStage("pendant").length).toBeGreaterThan(0);
    expect(getItemsByStage("apres").length).toBeGreaterThan(0);
  });
});

describe("createEmptyVisitChecklist", () => {
  it("initialise tous les éléments à false", () => {
    const checklist = createEmptyVisitChecklist();
    expect(Object.keys(checklist)).toHaveLength(VISIT_CHECKLIST_TEMPLATE.length);
    expect(Object.values(checklist).every((done) => done === false)).toBe(true);
  });
});

describe("computeVisitProgress", () => {
  it("retourne 0% pour une checklist vide, pour chaque étape", () => {
    const progress = computeVisitProgress(createEmptyVisitChecklist());
    expect(progress).toHaveLength(3);
    for (const stage of progress) {
      expect(stage.completed).toBe(0);
      expect(stage.percent).toBe(0);
    }
  });

  it("ne compte que les éléments de l'étape concernée", () => {
    const state = createEmptyVisitChecklist();
    const avantItems = getItemsByStage("avant");
    state[avantItems[0].id] = true;

    const progress = computeVisitProgress(state);
    const avant = progress.find((p) => p.stage === "avant")!;
    const pendant = progress.find((p) => p.stage === "pendant")!;

    expect(avant.completed).toBe(1);
    expect(avant.percent).toBe(Math.round((1 / avantItems.length) * 100));
    expect(pendant.completed).toBe(0);
  });

  it("ne compte jamais un élément absent du state comme fait", () => {
    const progress = computeVisitProgress({});
    for (const stage of progress) {
      expect(stage.completed).toBe(0);
    }
  });

  it("atteint 100% quand tous les éléments d'une étape sont cochés", () => {
    const state = createEmptyVisitChecklist();
    for (const item of getItemsByStage("pendant")) {
      state[item.id] = true;
    }
    const progress = computeVisitProgress(state);
    const pendant = progress.find((p) => p.stage === "pendant")!;
    expect(pendant.percent).toBe(100);
  });
});
