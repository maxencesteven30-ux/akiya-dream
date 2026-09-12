import { describe, expect, it } from "vitest";
import { createEmptyChecklist, computeCompletionSummary } from "@/lib/due-diligence";
import { REALITY_GATE_TEMPLATE, RECONSTRUCTION_ITEM_ID } from "@/lib/reality-gate";
import type { NextActionInput } from "@/lib/next-best-action";
import { computeAkiyaPassport } from "@/lib/akiya-passport";
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

const baseInput = {
  propertyName: "Maison Test",
  opportunityScore: 8.2,
  opportunityCategory: "tres_bonne" as const,
  feasibility: "compatible" as const,
  budget: { totalProjetJpy: 13_000_000, travauxJpy: 8_000_000, acquisitionJpy: 700_000 },
  nextActionInput: readyNextActionInput,
};

describe("computeAkiyaPassport", () => {
  it("ne dit jamais simplement 'bonne maison' : sépare toujours connu/estimé/inconnu/bloquant", () => {
    const passport = computeAkiyaPassport(baseInput);
    expect(passport.known.length).toBeGreaterThan(0);
    expect(passport.estimated.length).toBeGreaterThan(0);
    expect(passport.nextMostImportantInfo).toBeTruthy();
  });

  it("un bon score n'empêche jamais un blocage avéré d'apparaître", () => {
    const realityGate = { ...cleanRealityGate(), [RECONSTRUCTION_ITEM_ID]: "probleme" as const };
    const passport = computeAkiyaPassport({
      ...baseInput,
      nextActionInput: { ...readyNextActionInput, realityGate },
    });
    expect(passport.potentiallyBlocking.length).toBe(1);
    expect(passport.nextMostImportantInfo).toMatch(/municipalité/i);
  });

  it("une inconnue critique apparaît dans 'unknown', jamais convertie en connu", () => {
    const passport = computeAkiyaPassport({
      ...baseInput,
      nextActionInput: { ...readyNextActionInput, landNature: null },
    });
    expect(passport.unknown.some((u) => /terrain non confirmée/i.test(u))).toBe(true);
    expect(passport.potentiallyBlocking).toHaveLength(0);
  });

  it("répond 'prêt pour une offre' seulement quand aucun signal n'est actif", () => {
    const passport = computeAkiyaPassport(baseInput);
    expect(passport.nextMostImportantInfo).toBe("Projet prêt pour une offre.");
    expect(passport.unknown).toHaveLength(0);
    expect(passport.potentiallyBlocking).toHaveLength(0);
  });

  it("le dossier de due diligence incomplet apparaît dans les inconnues", () => {
    const state = createEmptyChecklist();
    const passport = computeAkiyaPassport({
      ...baseInput,
      nextActionInput: { ...readyNextActionInput, dueDiligence: state, completion: computeCompletionSummary(state) },
    });
    expect(passport.unknown.some((u) => /incomplet/i.test(u))).toBe(true);
  });
});
