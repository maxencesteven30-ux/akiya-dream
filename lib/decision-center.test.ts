import { describe, expect, it } from "vitest";
import {
  computeDecision,
  computeDocumentsCoverage,
  computeNextAction,
  computeVisitStatus,
} from "@/lib/decision-center";
import { CHECKLIST_TEMPLATE, createEmptyChecklist, computeCompletionSummary } from "@/lib/due-diligence";
import { createEmptyVisitChecklist, getItemsByStage, computeVisitProgress } from "@/lib/visit-checklist";
import type { ProjectDocument } from "@/lib/documents";

function makeDocument(category: ProjectDocument["category"], id = 1): ProjectDocument {
  return {
    id,
    projectId: 1,
    storagePath: `path/${id}`,
    fileName: `file-${id}.png`,
    category,
    contentType: "image/png",
    sizeBytes: 100,
    note: null,
    createdAt: new Date().toISOString(),
  };
}

describe("computeVisitStatus", () => {
  it("est non commencée pour une checklist vierge", () => {
    const progress = computeVisitProgress(createEmptyVisitChecklist());
    expect(computeVisitStatus(progress)).toBe("non_commencee");
  });

  it("est en cours dès qu'un élément est coché, même hors étape 'après'", () => {
    const state = createEmptyVisitChecklist();
    state[getItemsByStage("avant")[0].id] = true;
    expect(computeVisitStatus(computeVisitProgress(state))).toBe("en_cours");
  });

  it("est terminée seulement si l'étape 'après' est intégralement cochée", () => {
    const state = createEmptyVisitChecklist();
    const apresItems = getItemsByStage("apres");
    for (const item of apresItems.slice(0, -1)) state[item.id] = true;
    expect(computeVisitStatus(computeVisitProgress(state))).toBe("en_cours");

    state[apresItems[apresItems.length - 1].id] = true;
    expect(computeVisitStatus(computeVisitProgress(state))).toBe("terminee");
  });
});

describe("computeDocumentsCoverage", () => {
  it("retourne 0 pour aucun document", () => {
    const coverage = computeDocumentsCoverage([]);
    expect(coverage.documentsCount).toBe(0);
    expect(coverage.coveredCategories).toBe(0);
    expect(coverage.totalCategories).toBeGreaterThan(0);
  });

  it("compte les catégories distinctes, pas les documents", () => {
    const docs = [makeDocument("photo", 1), makeDocument("photo", 2), makeDocument("devis", 3)];
    const coverage = computeDocumentsCoverage(docs);
    expect(coverage.documentsCount).toBe(3);
    expect(coverage.coveredCategories).toBe(2);
  });
});

describe("computeDecision", () => {
  const fullCompletion = { completed: 29, total: 29, percent: 100, hasProblem: false };
  const emptyCompletion = { completed: 0, total: 29, percent: 0, hasProblem: false };

  it("bloque si un problème de due diligence est détecté, même sinon tout est vert", () => {
    const decision = computeDecision({
      hasProblem: true,
      feasibility: "compatible",
      completion: fullCompletion,
      visitStatus: "terminee",
    });
    expect(decision.level).toBe("bloque");
  });

  it("bloque si le budget est insuffisant", () => {
    const decision = computeDecision({
      hasProblem: false,
      feasibility: "insuffisant",
      completion: fullCompletion,
      visitStatus: "terminee",
    });
    expect(decision.level).toBe("bloque");
  });

  it("reste en vérifications si le dossier est incomplet", () => {
    const decision = computeDecision({
      hasProblem: false,
      feasibility: "compatible",
      completion: emptyCompletion,
      visitStatus: "terminee",
    });
    expect(decision.level).toBe("verifications");
  });

  it("reste en vérifications si la visite n'est pas terminée, même dossier complet", () => {
    const decision = computeDecision({
      hasProblem: false,
      feasibility: "compatible",
      completion: fullCompletion,
      visitStatus: "en_cours",
    });
    expect(decision.level).toBe("verifications");
  });

  it("est prêt seulement si tout est au vert", () => {
    const decision = computeDecision({
      hasProblem: false,
      feasibility: "compatible",
      completion: fullCompletion,
      visitStatus: "terminee",
    });
    expect(decision.level).toBe("pret");
  });
});

describe("computeNextAction", () => {
  const fullCompletion = { completed: 29, total: 29, percent: 100, hasProblem: false };

  it("priorise un problème de due diligence sur tout le reste", () => {
    const state = createEmptyChecklist();
    state["batiment_toiture"] = "probleme";
    const action = computeNextAction({
      dueDiligence: state,
      completion: computeCompletionSummary(state),
      feasibility: "compatible",
      visitStatus: "terminee",
      documentsCount: 5,
    });
    expect(action.message).toMatch(/toiture/i);
  });

  it("prend le premier problème dans l'ordre du template s'il y en a plusieurs", () => {
    const state = createEmptyChecklist();
    state["terrain_assainissement"] = "probleme";
    state["batiment_toiture"] = "probleme";
    const action = computeNextAction({
      dueDiligence: state,
      completion: computeCompletionSummary(state),
      feasibility: "compatible",
      visitStatus: "terminee",
      documentsCount: 5,
    });
    const toitureIndex = CHECKLIST_TEMPLATE.findIndex((i) => i.id === "batiment_toiture");
    const assainissementIndex = CHECKLIST_TEMPLATE.findIndex((i) => i.id === "terrain_assainissement");
    expect(toitureIndex).toBeLessThan(assainissementIndex);
    expect(action.message).toMatch(/toiture/i);
  });

  it("suggère de compléter le dossier si aucun problème mais dossier incomplet", () => {
    const state = createEmptyChecklist();
    const action = computeNextAction({
      dueDiligence: state,
      completion: computeCompletionSummary(state),
      feasibility: "compatible",
      visitStatus: "terminee",
      documentsCount: 5,
    });
    expect(action.reason).toBe("Dossier encore incomplet");
  });

  it("suggère de renseigner le budget si dossier complet mais budget inconnu", () => {
    const action = computeNextAction({
      dueDiligence: {},
      completion: fullCompletion,
      feasibility: null,
      visitStatus: "terminee",
      documentsCount: 5,
    });
    expect(action.reason).toBe("Budget non renseigné");
  });

  it("suggère de revoir le budget si insuffisant", () => {
    const action = computeNextAction({
      dueDiligence: {},
      completion: fullCompletion,
      feasibility: "insuffisant",
      visitStatus: "terminee",
      documentsCount: 5,
    });
    expect(action.reason).toBe("Budget insuffisant");
  });

  it("suggère de négocier si le budget est tendu", () => {
    const action = computeNextAction({
      dueDiligence: {},
      completion: fullCompletion,
      feasibility: "tendu",
      visitStatus: "terminee",
      documentsCount: 5,
    });
    expect(action.reason).toBe("Budget tendu");
  });

  it("suggère la visite si elle n'est pas terminée, tout le reste étant vert", () => {
    const action = computeNextAction({
      dueDiligence: {},
      completion: fullCompletion,
      feasibility: "compatible",
      visitStatus: "non_commencee",
      documentsCount: 5,
    });
    expect(action.reason).toBe("Visite non terminée");
  });

  it("suggère de rassembler les pièces si tout le reste est vert mais aucun document", () => {
    const action = computeNextAction({
      dueDiligence: {},
      completion: fullCompletion,
      feasibility: "compatible",
      visitStatus: "terminee",
      documentsCount: 0,
    });
    expect(action.reason).toBe("Aucun document ajouté");
  });

  it("confirme que le projet est prêt quand tout est au vert", () => {
    const action = computeNextAction({
      dueDiligence: {},
      completion: fullCompletion,
      feasibility: "compatible",
      visitStatus: "terminee",
      documentsCount: 3,
    });
    expect(action.message).toBe("Projet prêt pour une offre.");
  });
});
