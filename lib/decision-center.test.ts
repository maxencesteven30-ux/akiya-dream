import { describe, expect, it } from "vitest";
import {
  computeDecision,
  computeDocumentsCoverage,
  computeNextAction,
  computeVisitStatus,
} from "@/lib/decision-center";
import { CHECKLIST_TEMPLATE, createEmptyChecklist, computeCompletionSummary } from "@/lib/due-diligence";
import { createEmptyVisitChecklist, getItemsByStage, computeVisitProgress } from "@/lib/visit-checklist";
import { REALITY_GATE_TEMPLATE, RECONSTRUCTION_ITEM_ID } from "@/lib/reality-gate";
import type { ProjectDocument } from "@/lib/documents";
import type { RealityGateState } from "@/lib/types";

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

// Reality Gate "propre" (tout vérifié, terrain résidentiel) : utilisé
// comme base neutre pour les tests qui portent sur d'autres dimensions
// (due diligence, budget, visite, documents).
function cleanRealityGate(): RealityGateState {
  return Object.fromEntries(REALITY_GATE_TEMPLATE.map((item) => [item.id, "verifie"]));
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
      realityGateLevel: "vert",
      hasProblem: true,
      feasibility: "compatible",
      completion: fullCompletion,
      visitStatus: "terminee",
    });
    expect(decision.level).toBe("bloque");
  });

  it("bloque si le budget est insuffisant", () => {
    const decision = computeDecision({
      realityGateLevel: "vert",
      hasProblem: false,
      feasibility: "insuffisant",
      completion: fullCompletion,
      visitStatus: "terminee",
    });
    expect(decision.level).toBe("bloque");
  });

  it("bloque si le Reality Gate est rouge, même si tout le reste est vert", () => {
    const decision = computeDecision({
      realityGateLevel: "rouge",
      hasProblem: false,
      feasibility: "compatible",
      completion: fullCompletion,
      visitStatus: "terminee",
    });
    expect(decision.level).toBe("bloque");
  });

  it("reste en vérifications si le Reality Gate est orange, même dossier complet", () => {
    const decision = computeDecision({
      realityGateLevel: "orange",
      hasProblem: false,
      feasibility: "compatible",
      completion: fullCompletion,
      visitStatus: "terminee",
    });
    expect(decision.level).toBe("verifications");
  });

  it("reste en vérifications si le dossier est incomplet", () => {
    const decision = computeDecision({
      realityGateLevel: "vert",
      hasProblem: false,
      feasibility: "compatible",
      completion: emptyCompletion,
      visitStatus: "terminee",
    });
    expect(decision.level).toBe("verifications");
  });

  it("reste en vérifications si la visite n'est pas terminée, même dossier complet", () => {
    const decision = computeDecision({
      realityGateLevel: "vert",
      hasProblem: false,
      feasibility: "compatible",
      completion: fullCompletion,
      visitStatus: "en_cours",
    });
    expect(decision.level).toBe("verifications");
  });

  it("est prêt seulement si tout est au vert, Reality Gate inclus", () => {
    const decision = computeDecision({
      realityGateLevel: "vert",
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
  const baseInput = {
    realityGate: cleanRealityGate(),
    landNature: "residentiel" as const,
    dueDiligence: {},
    completion: fullCompletion,
    feasibility: "compatible" as const,
    visitStatus: "terminee" as const,
    documentsCount: 5,
  };

  it("priorise un terrain agricole sur tout le reste, y compris un problème de due diligence", () => {
    const dueDiligenceState = createEmptyChecklist();
    dueDiligenceState["batiment_toiture"] = "probleme";
    const action = computeNextAction({
      ...baseInput,
      landNature: "agricole",
      dueDiligence: dueDiligenceState,
      completion: computeCompletionSummary(dueDiligenceState),
    });
    expect(action.reason).toBe("Terrain agricole soumis à restrictions");
  });

  it("priorise un élément Reality Gate 'problème' sur un problème de due diligence", () => {
    const dueDiligenceState = createEmptyChecklist();
    dueDiligenceState["batiment_toiture"] = "probleme";
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "probleme" as const };
    const action = computeNextAction({
      ...baseInput,
      realityGate,
      dueDiligence: dueDiligenceState,
      completion: computeCompletionSummary(dueDiligenceState),
    });
    expect(action.message).toMatch(/reconstruire/i);
  });

  it("priorise un problème de due diligence sur tout le reste (Reality Gate propre)", () => {
    const state = createEmptyChecklist();
    state["batiment_toiture"] = "probleme";
    const action = computeNextAction({
      ...baseInput,
      dueDiligence: state,
      completion: computeCompletionSummary(state),
    });
    expect(action.message).toMatch(/toiture/i);
  });

  it("prend le premier problème dans l'ordre du template s'il y en a plusieurs", () => {
    const state = createEmptyChecklist();
    state["terrain_assainissement"] = "probleme";
    state["batiment_toiture"] = "probleme";
    const action = computeNextAction({
      ...baseInput,
      dueDiligence: state,
      completion: computeCompletionSummary(state),
    });
    const toitureIndex = CHECKLIST_TEMPLATE.findIndex((i) => i.id === "batiment_toiture");
    const assainissementIndex = CHECKLIST_TEMPLATE.findIndex((i) => i.id === "terrain_assainissement");
    expect(toitureIndex).toBeLessThan(assainissementIndex);
    expect(action.message).toMatch(/toiture/i);
  });

  it("demande de confirmer la nature du terrain si non renseignée, avant même le dossier incomplet", () => {
    const action = computeNextAction({
      ...baseInput,
      landNature: null,
      completion: { completed: 0, total: 29, percent: 0, hasProblem: false },
    });
    expect(action.reason).toBe("Nature du terrain non confirmée");
  });

  it("le message pour une nature de terrain non confirmée ne présuppose pas un statut agricole déjà établi", () => {
    const unconfirmedAction = computeNextAction({
      ...baseInput,
      landNature: null,
      completion: { completed: 0, total: 29, percent: 0, hasProblem: false },
    });
    const agricoleAction = computeNextAction({ ...baseInput, landNature: "agricole" });
    expect(unconfirmedAction.message).not.toMatch(/statut agricole/i);
    expect(unconfirmedAction.message).not.toBe(agricoleAction.message);
  });

  it("demande de confirmer un élément Reality Gate non confirmé, avant le dossier incomplet", () => {
    const action = computeNextAction({
      ...baseInput,
      realityGate: createEmptyChecklistLikeRealityGate(),
      completion: { completed: 0, total: 29, percent: 0, hasProblem: false },
    });
    expect(action.reason).toMatch(/À confirmer \(Reality Gate\)/);
  });

  it("suggère de compléter le dossier si aucun problème mais dossier incomplet", () => {
    const state = createEmptyChecklist();
    const action = computeNextAction({
      ...baseInput,
      dueDiligence: state,
      completion: computeCompletionSummary(state),
    });
    expect(action.reason).toBe("Dossier encore incomplet");
  });

  it("suggère de renseigner le budget si dossier complet mais budget inconnu", () => {
    const action = computeNextAction({ ...baseInput, feasibility: null });
    expect(action.reason).toBe("Budget non renseigné");
  });

  it("suggère de revoir le budget si insuffisant", () => {
    const action = computeNextAction({ ...baseInput, feasibility: "insuffisant" });
    expect(action.reason).toBe("Budget insuffisant");
  });

  it("suggère de négocier si le budget est tendu", () => {
    const action = computeNextAction({ ...baseInput, feasibility: "tendu" });
    expect(action.reason).toBe("Budget tendu");
  });

  it("suggère la visite si elle n'est pas terminée, tout le reste étant vert", () => {
    const action = computeNextAction({ ...baseInput, visitStatus: "non_commencee" });
    expect(action.reason).toBe("Visite non terminée");
  });

  it("suggère de rassembler les pièces si tout le reste est vert mais aucun document", () => {
    const action = computeNextAction({ ...baseInput, documentsCount: 0 });
    expect(action.reason).toBe("Aucun document ajouté");
  });

  it("confirme que le projet est prêt quand tout est au vert", () => {
    const action = computeNextAction(baseInput);
    expect(action.message).toBe("Projet prêt pour une offre.");
  });
});

function createEmptyChecklistLikeRealityGate(): RealityGateState {
  return Object.fromEntries(REALITY_GATE_TEMPLATE.map((item) => [item.id, "a_confirmer"]));
}
