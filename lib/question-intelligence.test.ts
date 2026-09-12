import { describe, expect, it } from "vitest";
import { createEmptyChecklist, computeCompletionSummary } from "@/lib/due-diligence";
import { REALITY_GATE_TEMPLATE, RECONSTRUCTION_ITEM_ID } from "@/lib/reality-gate";
import { createEmptyRemoteOwnerProfile } from "@/lib/remote-owner";
import { createEmptyExitStrategyProfile } from "@/lib/exit-strategy";
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
  budget: {
    totalProjetJpy: 13_000_000,
    travauxJpy: 8_000_000,
    acquisitionJpy: 700_000,
    aidesJpy: 2_500_000,
    maxAffordablePriceJpy: null,
  },
  remoteOwner: createEmptyRemoteOwnerProfile(),
  exitStrategy: createEmptyExitStrategyProfile(),
  history: [],
  riskFlags: [],
  capitalDisponibleEur: null,
  reserveSecuriteEur: null,
  comparisonData: [],
  fxRate: null,
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

describe("computeQuestionAnswer — questions Reality Gate génériques (Q03/Q04/Q05/Q13-16/Q21/Q22)", () => {
  it("Q03 (reconstruction) est GREEN quand l'item est vérifié", () => {
    const answer = computeQuestionAnswer("Q03", readySnapshot);
    expect(answer?.verdict).toBe("GREEN");
    expect(answer?.status).toBe("ANSWERED");
  });

  it("Q03 (reconstruction) est RED et propose l'action de résolution quand l'item est un problème", () => {
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "probleme" as const };
    const answer = computeQuestionAnswer("Q03", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, realityGate },
    });
    expect(answer?.verdict).toBe("RED");
    expect(answer?.nextBestAction).toMatch(/municipalité/i);
  });

  it("Q21 (propriété du terrain) est ORANGE par défaut (jamais vert par défaut)", () => {
    const answer = computeQuestionAnswer("Q21", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, realityGate: {} },
    });
    expect(answer?.verdict).toBe("ORANGE");
    expect(answer?.unknowns[0]).toMatch(/titre de propriété/i);
  });

  it("Q14 (plomberie) combine eau et égout : un seul problème suffit à passer en rouge", () => {
    const realityGate = { ...cleanRealityGate(), reseau_egout: "probleme" as const };
    const answer = computeQuestionAnswer("Q14", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, realityGate },
    });
    expect(answer?.verdict).toBe("RED");
  });
});

describe("computeQuestionAnswer — Remote Owner / Exit Strategy (Q24, Q27, Q51, Q57)", () => {
  it("Q24 signale un avertissement quand l'objectif est 'future_residence' sans plan de séjour confirmé", () => {
    const answer = computeQuestionAnswer("Q24", {
      ...readySnapshot,
      remoteOwner: { ...createEmptyRemoteOwnerProfile(), ownershipGoal: "future_residence" },
    });
    expect(answer?.verdict).toBe("ORANGE");
    expect(answer?.unknowns.length).toBeGreaterThan(0);
  });

  it("Q24 n'avertit pas quand aucun objectif de résidence future n'est déclaré", () => {
    const answer = computeQuestionAnswer("Q24", readySnapshot);
    expect(answer?.verdict).toBeNull();
  });

  it("Q27 (minpaku) ne conclut jamais autorisé par défaut sans intention déclarée", () => {
    const answer = computeQuestionAnswer("Q27", readySnapshot);
    expect(answer?.status).toBe("PARTIAL");
    expect(answer?.answer).toMatch(/aucune intention/i);
  });

  it("Q27 (minpaku) reflète la checklist réelle une fois l'intention déclarée", () => {
    const answer = computeQuestionAnswer("Q27", {
      ...readySnapshot,
      exitStrategy: { ...createEmptyExitStrategyProfile(), strategy: "minpaku" },
    });
    expect(answer?.status).toBe("ANSWERED");
    expect(answer?.verdict).toBe("ORANGE");
  });

  it("Q51 (risque de vacance) ne renvoie jamais une probabilité inventée, seulement des raisons", () => {
    const answer = computeQuestionAnswer("Q51", {
      ...readySnapshot,
      remoteOwner: {
        ...createEmptyRemoteOwnerProfile(),
        caretaker: "personne",
        vacancyDuration: "quelques_mois",
        checkFrequency: "annuelle",
      },
    });
    expect(answer?.verdict).toBe("RED");
    for (const reason of answer?.unknowns ?? []) {
      expect(reason).not.toMatch(/%/);
    }
  });

  it("Q57 (démolir vs rénover) refuse de comparer les coûts tant que la reconstruction n'est pas vérifiée", () => {
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "a_confirmer" as const };
    const answer = computeQuestionAnswer("Q57", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, realityGate },
    });
    expect(answer?.status).toBe("PARTIAL");
    expect(answer?.unknowns[0]).toMatch(/droit à reconstruire/i);
  });

  it("Q57 compare rénovation et démolition seulement une fois la reconstruction vérifiée et le devis renseigné", () => {
    const answer = computeQuestionAnswer("Q57", {
      ...readySnapshot,
      exitStrategy: { ...createEmptyExitStrategyProfile(), demolitionCostJpy: 3_000_000 },
    });
    expect(answer?.status).toBe("ANSWERED");
    expect(answer?.answer).toMatch(/écart/i);
  });
});

describe("computeQuestionAnswer — Q06, Q65, Q69, Q70", () => {
  it("Q06 sépare acquisition (fait) et travaux (estimation) sans double compter", () => {
    const answer = computeQuestionAnswer("Q06", readySnapshot);
    expect(answer?.knownFacts[0]).toMatch(/acquisition/i);
    expect(answer?.estimates[0]).toMatch(/travaux/i);
  });

  it("Q65 confirme le filtrage cote serveur (RLS), pas seulement l'UI", () => {
    const answer = computeQuestionAnswer("Q65", readySnapshot);
    expect(answer?.verdict).toBe("GREEN");
    expect(answer?.answer).toMatch(/RLS|Row Level Security/);
  });

  it("Q69 répond honnêtement quand aucun historique n'existe", () => {
    const answer = computeQuestionAnswer("Q69", readySnapshot);
    expect(answer?.answer).toMatch(/aucun point d'étape/i);
  });

  it("Q70 demande un point d'étape après visite s'il n'y en a pas", () => {
    const answer = computeQuestionAnswer("Q70", readySnapshot);
    expect(answer?.status).toBe("PARTIAL");
  });

  it("Q70 calcule l'écart réel entre avant et après visite quand les deux existent", () => {
    const answer = computeQuestionAnswer("Q70", {
      ...readySnapshot,
      history: [
        {
          id: "1",
          timestamp: "2026-01-01T00:00:00.000Z",
          housePriceJpy: 5_000_000,
          travauxJpy: 8_000_000,
          totalProjetJpy: 13_000_000,
          eurJpyRate: 160,
          opportunityScore: 7,
          isPostVisit: false,
        },
        {
          id: "2",
          timestamp: "2026-02-01T00:00:00.000Z",
          housePriceJpy: 4_800_000,
          travauxJpy: 9_000_000,
          totalProjetJpy: 13_800_000,
          eurJpyRate: 160,
          opportunityScore: 6.5,
          isPostVisit: true,
        },
      ],
    });
    expect(answer?.status).toBe("ANSWERED");
    expect(answer?.answer).toMatch(/-200.000 JPY/);
    expect(answer?.answer).toMatch(/\+1.000.000 JPY/);
  });
});

describe("computeQuestionAnswer — checklists generees (Q35, Q36, Q37, Q53, Q54, Q68)", () => {
  it("Q35 liste les blocages et inconnues critiques, jamais les optimisations", () => {
    const answer = computeQuestionAnswer("Q35", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, landNature: null },
    });
    expect(answer?.verdict).toBe("ORANGE");
    expect(answer?.unknowns.length).toBeGreaterThan(0);
  });

  it("Q35 repond qu'il n'y a rien a verifier quand tout est vert", () => {
    const answer = computeQuestionAnswer("Q35", readySnapshot);
    expect(answer?.verdict).toBe("GREEN");
  });

  it("Q36 ne liste que les items batiment/terrain non verifies", () => {
    const dueDiligence = createEmptyChecklist();
    dueDiligence["batiment_toiture"] = "a_verifier";
    dueDiligence["vie_locale_gare"] = "a_verifier";
    const answer = computeQuestionAnswer("Q36", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, dueDiligence, completion: computeCompletionSummary(dueDiligence) },
    });
    expect(answer?.unknowns).toContain("Toiture");
    expect(answer?.unknowns).not.toContain("Gare");
  });

  it("Q54 ne pose des questions que sur des problemes deja constates (preuve avant opinion)", () => {
    const dueDiligence = createEmptyChecklist();
    dueDiligence["batiment_toiture"] = "probleme";
    const answer = computeQuestionAnswer("Q54", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, dueDiligence, completion: computeCompletionSummary(dueDiligence) },
    });
    expect(answer?.verdict).toBe("ORANGE");
    expect(answer?.unknowns[0]).toMatch(/toiture/i);
  });

  it("Q54 n'accuse de rien quand aucun probleme n'est constate", () => {
    const answer = computeQuestionAnswer("Q54", readySnapshot);
    expect(answer?.verdict).toBe("GREEN");
    expect(answer?.unknowns).toHaveLength(0);
  });

  it("Q68 separe explicitement completude et blocages", () => {
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "probleme" as const };
    const answer = computeQuestionAnswer("Q68", {
      ...readySnapshot,
      nextActionInput: { ...readyNextActionInput, realityGate, completion: { completed: 29, total: 29, percent: 100, hasProblem: false } },
    });
    expect(answer?.verdict).toBe("RED");
    expect(answer?.answer).toMatch(/100%/);
  });
});

describe("computeQuestionAnswer — Q30, Q56 (jamais acquis/garanti par defaut)", () => {
  it("Q30 ne presente jamais une aide comme acquise", () => {
    const answer = computeQuestionAnswer("Q30", readySnapshot);
    expect(answer?.answer).toMatch(/jamais acquis/i);
  });

  it("Q56 repond honnetement sans hypothese renseignee", () => {
    const answer = computeQuestionAnswer("Q56", readySnapshot);
    expect(answer?.status).toBe("PARTIAL");
  });

  it("Q56 affiche l'hypothese utilisateur sans jamais la presenter comme garantie", () => {
    const answer = computeQuestionAnswer("Q56", {
      ...readySnapshot,
      exitStrategy: { ...createEmptyExitStrategyProfile(), monthlyRentJpy: 50_000, occupancyRatePercent: 80 },
    });
    expect(answer?.status).toBe("ANSWERED");
    expect(answer?.answer).toMatch(/jamais un rendement garanti/i);
  });
});

describe("computeQuestionAnswer — Q08 (plafond financier)", () => {
  it("repond honnetement si capital/reserve ne sont pas renseignes", () => {
    const answer = computeQuestionAnswer("Q08", readySnapshot);
    expect(answer?.status).toBe("PARTIAL");
  });

  it("affiche le plafond calcule sans jamais le presenter comme une valeur de marche", () => {
    const answer = computeQuestionAnswer("Q08", {
      ...readySnapshot,
      budget: { ...readySnapshot.budget, maxAffordablePriceJpy: 6_000_000 },
    });
    expect(answer?.status).toBe("ANSWERED");
    expect(answer?.answer).toMatch(/n'est pas une valeur de marché/i);
  });
});

describe("computeQuestionAnswer — Q44 (facteurs de risque budgetaire)", () => {
  it("combine risques documentes et inconnues critiques sans inventer de montant", () => {
    const answer = computeQuestionAnswer("Q44", {
      ...readySnapshot,
      riskFlags: [{ key: "acces_isole", message: "Accès isolé : coûts de déneigement/entretien potentiellement plus élevés." }],
      nextActionInput: { ...readyNextActionInput, landNature: null },
    });
    expect(answer?.unknowns.length).toBe(2);
    expect(answer?.unknowns[0]).toMatch(/déneigement/i);
  });

  it("repond qu'aucun risque n'est identifie quand tout est vert", () => {
    const answer = computeQuestionAnswer("Q44", readySnapshot);
    expect(answer?.verdict).toBe("GREEN");
  });
});

describe("computeQuestionAnswer — Q34 (reserve d'urgence)", () => {
  it("ne fixe jamais un montant universel : repond PARTIAL si rien n'est renseigne", () => {
    const answer = computeQuestionAnswer("Q34", readySnapshot);
    expect(answer?.status).toBe("PARTIAL");
    expect(answer?.answer).toMatch(/aucun montant universel|il n'existe pas de montant universel/i);
  });

  it("affiche la reserve reellement saisie sans la comparer a une norme", () => {
    const answer = computeQuestionAnswer("Q34", {
      ...readySnapshot,
      capitalDisponibleEur: 100_000,
      reserveSecuriteEur: 10_000,
    });
    expect(answer?.status).toBe("ANSWERED");
    expect(answer?.knownFacts[0]).toMatch(/10.000/);
  });
});

describe("computeQuestionAnswer — Q47 (comparaison objective)", () => {
  it("repond PARTIAL si le comparateur contient moins de 2 projets", () => {
    const answer = computeQuestionAnswer("Q47", { ...readySnapshot, comparisonData: [] });
    expect(answer?.status).toBe("PARTIAL");
  });

  it("compare les memes dimensions pour chaque projet sans inventer de score manquant", () => {
    const answer = computeQuestionAnswer("Q47", {
      ...readySnapshot,
      comparisonData: [
        { propertyId: "1", name: "Maison A", totalBudgetJpy: 10_000_000, totalBudgetEur: 55_000, opportunityScore: 8, feasibilityVerdict: "✅ Oui", renovationDurationMonths: 4 },
        { propertyId: "2", name: "Maison B", totalBudgetJpy: 12_000_000, totalBudgetEur: 66_000, opportunityScore: null, feasibilityVerdict: null, renovationDurationMonths: 8 },
      ],
    });
    expect(answer?.status).toBe("ANSWERED");
    expect(answer?.knownFacts).toEqual(["Maison A : 8.0/10"]);
    expect(answer?.unknowns[0]).toMatch(/Maison B/);
  });
});

describe("computeQuestionAnswer — Q46 (sensibilite FX)", () => {
  it("repond honnetement si aucun taux n'a ete consulte (jamais un taux invente)", () => {
    const answer = computeQuestionAnswer("Q46", readySnapshot);
    expect(answer?.status).toBe("PARTIAL");
    expect(answer?.unknowns).toContain("Taux EUR/JPY daté");
  });

  it("simule +/-10% sans jamais predire le marche, en citant la source et la date", () => {
    const answer = computeQuestionAnswer("Q46", {
      ...readySnapshot,
      fxRate: { pair: "EUR/JPY", rate: 180, sourceDate: "2026-09-11" },
    });
    expect(answer?.status).toBe("ANSWERED");
    expect(answer?.answer).toMatch(/2026-09-11/);
    expect(answer?.answer).toMatch(/simulation, jamais une prédiction/i);
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

  it("couvre les 70 questions : plus aucune n'est cluster A/B sans handler", () => {
    const answerable = listAnswerableQuestions();
    expect(answerable).toHaveLength(70);
  });
});
