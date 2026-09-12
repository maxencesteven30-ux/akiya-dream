import { describe, expect, it } from "vitest";
import {
  REALITY_GATE_TEMPLATE,
  REALITY_GATE_DOCUMENTS_TEMPLATE,
  REALITY_GATE_PROBLEM_ACTIONS,
  RECONSTRUCTION_ITEM_ID,
  computeDocumentsAvailability,
  computeLandNatureSeverity,
  computeRealityGate,
  createEmptyRealityGate,
  createEmptyRealityGateDocuments,
  getItemsByCategory,
  getRealityGateMessage,
} from "@/lib/reality-gate";
import type { RealityGateState } from "@/lib/types";

describe("REALITY_GATE_TEMPLATE", () => {
  it("n'a aucun identifiant dupliqué", () => {
    const ids = REALITY_GATE_TEMPLATE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("couvre les 4 catégories acces/reconstruction/reseaux/propriete", () => {
    expect(getItemsByCategory("acces").length).toBeGreaterThan(0);
    expect(getItemsByCategory("reconstruction")).toHaveLength(1);
    expect(getItemsByCategory("reseaux").length).toBeGreaterThan(0);
    expect(getItemsByCategory("propriete")).toHaveLength(3);
  });

  it("chaque item du template a une action de résolution dédiée (pas de fallback générique)", () => {
    for (const item of REALITY_GATE_TEMPLATE) {
      expect(REALITY_GATE_PROBLEM_ACTIONS[item.id]).toBeTruthy();
    }
  });
});

describe("createEmptyRealityGate", () => {
  it("initialise tous les éléments à 'à confirmer' (jamais vérifié par défaut)", () => {
    const state = createEmptyRealityGate();
    expect(Object.keys(state)).toHaveLength(REALITY_GATE_TEMPLATE.length);
    expect(Object.values(state).every((s) => s === "a_confirmer")).toBe(true);
  });
});

describe("computeLandNatureSeverity", () => {
  it("le terrain agricole est un problème", () => {
    expect(computeLandNatureSeverity("agricole")).toBe("probleme");
  });

  it("le terrain résidentiel est vérifié", () => {
    expect(computeLandNatureSeverity("residentiel")).toBe("verifie");
  });

  it("le terrain forestier est à confirmer", () => {
    expect(computeLandNatureSeverity("forestier")).toBe("a_confirmer");
  });

  it("non renseigné (null) est à confirmer, jamais résidentiel par défaut", () => {
    expect(computeLandNatureSeverity(null)).toBe("a_confirmer");
  });
});

describe("computeDocumentsAvailability", () => {
  it("retourne 0 pour un état vide", () => {
    const summary = computeDocumentsAvailability(createEmptyRealityGateDocuments());
    expect(summary.available).toBe(0);
    expect(summary.total).toBe(REALITY_GATE_DOCUMENTS_TEMPLATE.length);
  });

  it("compte les documents marqués disponibles", () => {
    const state = createEmptyRealityGateDocuments();
    state[REALITY_GATE_DOCUMENTS_TEMPLATE[0].id] = true;
    state[REALITY_GATE_DOCUMENTS_TEMPLATE[1].id] = true;
    expect(computeDocumentsAvailability(state).available).toBe(2);
  });
});

describe("computeRealityGate", () => {
  it("est vert si tout est vérifié et le terrain résidentiel", () => {
    const state: RealityGateState = Object.fromEntries(
      REALITY_GATE_TEMPLATE.map((item) => [item.id, "verifie"]),
    );
    const result = computeRealityGate(state, "residentiel");
    expect(result.level).toBe("vert");
    expect(result.blockingCount).toBe(0);
  });

  it("est orange si des éléments restent à confirmer, sans blocage", () => {
    const result = computeRealityGate(createEmptyRealityGate(), "residentiel");
    expect(result.level).toBe("orange");
    expect(result.toConfirmCount).toBeGreaterThan(0);
  });

  it("est rouge dès qu'un seul élément est un problème, même si tout le reste est vérifié", () => {
    const state: RealityGateState = Object.fromEntries(
      REALITY_GATE_TEMPLATE.map((item) => [item.id, "verifie"]),
    );
    state[RECONSTRUCTION_ITEM_ID] = "probleme";
    const result = computeRealityGate(state, "residentiel");
    expect(result.level).toBe("rouge");
    expect(result.blockingCount).toBe(1);
  });

  it("est rouge si le terrain est agricole, même si tous les items sont vérifiés", () => {
    const state: RealityGateState = Object.fromEntries(
      REALITY_GATE_TEMPLATE.map((item) => [item.id, "verifie"]),
    );
    const result = computeRealityGate(state, "agricole");
    expect(result.level).toBe("rouge");
  });

  it("un état vide + terrain non renseigné n'est jamais vert", () => {
    const result = computeRealityGate({}, null);
    expect(result.level).not.toBe("vert");
  });
});

describe("getRealityGateMessage", () => {
  it("message vert quand aucun blocage", () => {
    expect(getRealityGateMessage({ level: "vert", blockingCount: 0, toConfirmCount: 0 })).toMatch(
      /Aucun blocage/,
    );
  });

  it("message orange avec le nombre d'éléments à confirmer", () => {
    const msg = getRealityGateMessage({ level: "orange", blockingCount: 0, toConfirmCount: 5 });
    expect(msg).toContain("5");
    expect(msg).toMatch(/à confirmer/);
  });

  it("message rouge avec le nombre de blocages", () => {
    const msg = getRealityGateMessage({ level: "rouge", blockingCount: 1, toConfirmCount: 2 });
    expect(msg).toContain("1");
    expect(msg).toMatch(/blocage/);
  });
});
