import { describe, expect, it } from "vitest";
import { createEmptyChecklist, computeCompletionSummary } from "@/lib/due-diligence";
import { REALITY_GATE_TEMPLATE, RECONSTRUCTION_ITEM_ID } from "@/lib/reality-gate";
import type { NextActionInput } from "@/lib/next-best-action";
import {
  QUESTION_REGISTRY,
  QUESTION_BY_ID,
  computeQuestionAnswer,
  listAnswerableQuestions,
  type ProjectSnapshot,
} from "@/lib/question-intelligence";
import type { RealityGateState } from "@/lib/types";

function cleanRealityGate(): RealityGateState {
  return Object.fromEntries(REALITY_GATE_TEMPLATE.map((item) => [item.id, "verifie"]));
}

const fullCompletion = { completed: 29, total: 29, percent: 100, hasProblem: false };

const readyNextActionInput: NextActionInput = {
  realityGate: cleanRealityGate(),
  landNature: "residentiel",
  dueDiligence: {},
  completion: fullCompletion,
  feasibility: "compatible",
  visitStatus: "terminee",
  documentsCount: 5,
};

const readySnapshot: ProjectSnapshot = {
  nextActionInput: readyNextActionInput,
  opportunityScore: 8.2,
  opportunityCategory: "tres_bonne",
  budget: { totalProjetJpy: 13_000_000, travauxJpy: 8_000_000, acquisitionJpy: 700_000, aidesJpy: 2_500_000 },
};

describe("QUESTION_REGISTRY", () => {
  it("contient exactement 70 questions, sans identifiant dupliqué", () => {
    expect(QUESTION_REGISTRY).toHaveLength(70);
    const ids = QUESTION_REGISTRY.map((q) => q.id);
    expect(new Set(ids).size).toBe(70);
  });

  it("chaque question du cluster E a une cible de routage professionnel", () => {
    for (const q of QUESTION_REGISTRY.filter((q) => q.cluster === "E")) {
      expect(q.routeTo).toBeDefined();
    }
  });

  it("QUESTION_BY_ID retrouve chaque question par son id", () => {
    expect(QUESTION_BY_ID["Q01"]?.id).toBe("Q01");
    expect(QUESTION_BY_ID["Q70"]?.id).toBe("Q70");
  });
});

describe("computeQuestionAnswer — clusters génériques", () => {
  it("cluster C (donnée manquante) répond explicitement 'information insuffisante' sans inventer", () => {
    const answer = computeQuestionAnswer("Q01", readySnapshot);
    expect(answer?.status).toBe("INSUFFICIENT_DATA");
    expect(answer?.answer).toBe("Information insuffisante pour répondre.");
    expect(answer?.unknowns[0]).toMatch(/transactions comparables/i);
  });

  it("cluster D (source officielle) ne prétend jamais avoir la réponse", () => {
    const answer = computeQuestionAnswer("Q18", readySnapshot);
    expect(answer?.status).toBe("REQUIRES_OFFICIAL_SOURCE");
    expect(answer?.answer).toMatch(/source officielle/i);
    expect(answer?.answer).not.toMatch(/hors zone|sans risque/i);
  });

  it("cluster E (orientation professionnelle) ne pose jamais de diagnostic", () => {
    const answer = computeQuestionAnswer("Q09", readySnapshot);
    expect(answer?.status).toBe("REQUIRES_PROFESSIONAL");
    expect(answer?.answer).toMatch(/professionnel du bâtiment/i);
  });

  it("retourne null pour une question cluster A/B non encore câblée (pas de réponse inventée)", () => {
    const answer = computeQuestionAnswer("Q06", readySnapshot);
    expect(answer).toBeNull();
  });

  it("retourne null pour un identifiant de question inconnu", () => {
    expect(computeQuestionAnswer("Q999", readySnapshot)).toBeNull();
  });
});

describe("computeQuestionAnswer — Q02 (bonne affaire ?)", () => {
  it("une bonne note ne masque jamais un blocage avéré", () => {
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "probleme" as const };
    const answer = computeQuestionAnswer("Q02", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, realityGate },
    });
    expect(answer?.verdict).toBe("RED");
    expect(answer?.answer).toMatch(/non, pas en l'état/i);
  });

  it("répond ANSWERED avec verdict GREEN quand tout est vérifié", () => {
    const answer = computeQuestionAnswer("Q02", readySnapshot);
    expect(answer?.status).toBe("ANSWERED");
    expect(answer?.verdict).toBe("GREEN");
  });
});

describe("computeQuestionAnswer — Q40 (offre maintenant ou attendre ?)", () => {
  it("répond stop (RED) si un blocage est actif", () => {
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "probleme" as const };
    const answer = computeQuestionAnswer("Q40", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, realityGate },
    });
    expect(answer?.verdict).toBe("RED");
  });

  it("répond verify (ORANGE) si seule une inconnue critique existe", () => {
    const answer = computeQuestionAnswer("Q40", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, landNature: null },
    });
    expect(answer?.verdict).toBe("ORANGE");
  });

  it("répond ready (GREEN) quand rien ne bloque", () => {
    const answer = computeQuestionAnswer("Q40", readySnapshot);
    expect(answer?.verdict).toBe("GREEN");
  });
});

describe("computeQuestionAnswer — Q39 (routage professionnel déterministe)", () => {
  it("route vers un juriste pour un problème juridique de due diligence", () => {
    const dueDiligence = createEmptyChecklist();
    dueDiligence["juridique_acces"] = "probleme";
    const answer = computeQuestionAnswer("Q39", {
      ...readySnapshot,
      nextActionInput: {
        ...readyNextActionInput,
        dueDiligence,
        completion: computeCompletionSummary(dueDiligence),
      },
    });
    expect(answer?.answer).toMatch(/juriste/i);
  });
});

describe("computeQuestionAnswer — Q45 (segmentation certitude)", () => {
  it("sépare toujours les faits des estimations, jamais mélangés", () => {
    const answer = computeQuestionAnswer("Q45", readySnapshot);
    expect(answer?.knownFacts.length).toBeGreaterThan(0);
    expect(answer?.estimates.length).toBeGreaterThan(0);
  });
});

describe("computeQuestionAnswer — Q62 (traçabilité, pas de boîte noire)", () => {
  it("expose la règle et les champs utilisés du signal actif", () => {
    const answer = computeQuestionAnswer("Q62", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, landNature: null },
    });
    expect(answer?.reason.ruleId).toBeTruthy();
    expect(answer?.answer).toMatch(/règle appliquée/i);
  });
});

describe("listAnswerableQuestions", () => {
  it("n'inclut que les questions C/D/E ou dotées d'un handler A/B réel", () => {
    const answerable = listAnswerableQuestions();
    for (const q of answerable) {
      const answer = computeQuestionAnswer(q.id, readySnapshot);
      expect(answer).not.toBeNull();
    }
  });

  it("exclut une question A/B non câblée comme Q06", () => {
    const answerable = listAnswerableQuestions();
    expect(answerable.find((q) => q.id === "Q06")).toBeUndefined();
  });
});
