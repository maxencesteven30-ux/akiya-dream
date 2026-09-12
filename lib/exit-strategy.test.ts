import { describe, expect, it } from "vitest";
import {
  MINPAKU_CHECKLIST_TEMPLATE,
  computeDemolitionComparison,
  computeMinpakuChecklistSummary,
  computeRentalSimulation,
  computeResaleSimulation,
  createEmptyExitStrategyProfile,
  createEmptyMinpakuChecklist,
} from "@/lib/exit-strategy";

describe("createEmptyExitStrategyProfile", () => {
  it("initialise tout à null/vide, jamais une hypothèse par défaut", () => {
    const profile = createEmptyExitStrategyProfile();
    expect(profile.strategy).toBeNull();
    expect(profile.horizonYears).toBe(10);
    expect(profile.resaleValueJpy).toBeNull();
    expect(profile.monthlyRentJpy).toBeNull();
    expect(profile.occupancyRatePercent).toBeNull();
    expect(profile.demolitionCostJpy).toBeNull();
    expect(profile.minpakuChecklist).toEqual({});
  });
});

describe("computeResaleSimulation", () => {
  it("calcule le coût net à partir des hypothèses fournies", () => {
    const result = computeResaleSimulation({
      capitalInvestiJpy: 10_000_000,
      totalAnnuelJpy: 200_000,
      horizonYears: 10,
      resaleValueJpy: 12_000_000,
    });
    expect(result.capitalInvestiJpy).toBe(10_000_000);
    expect(result.fraisCumulesJpy).toBe(2_000_000);
    expect(result.fraisSortieJpy).toBeGreaterThan(0);
    expect(result.produitVenteJpy).toBe(12_000_000 - result.fraisSortieJpy);
    expect(result.coutNetJpy).toBe(10_000_000 + 2_000_000 - result.produitVenteJpy);
  });

  it("un horizon plus long augmente les frais cumulés, toutes choses égales par ailleurs", () => {
    const base = { capitalInvestiJpy: 10_000_000, totalAnnuelJpy: 200_000, resaleValueJpy: 12_000_000 };
    const dix = computeResaleSimulation({ ...base, horizonYears: 10 });
    const vingt = computeResaleSimulation({ ...base, horizonYears: 20 });
    expect(vingt.fraisCumulesJpy).toBeGreaterThan(dix.fraisCumulesJpy);
  });
});

describe("computeRentalSimulation", () => {
  it("calcule le rendement brut et le cash-flow estimé", () => {
    const result = computeRentalSimulation({
      prixAchatJpy: 5_000_000,
      monthlyRentJpy: 50_000,
      occupancyRatePercent: 80,
      totalAnnuelJpy: 200_000,
    });
    const revenuAttendu = 50_000 * 12 * 0.8;
    expect(result.revenuAnnuelBrutJpy).toBeCloseTo(revenuAttendu);
    expect(result.rendementBrutPercent).toBeCloseTo((revenuAttendu / 5_000_000) * 100);
    expect(result.cashFlowEstimeJpy).toBeCloseTo(revenuAttendu - 200_000);
  });

  it("un taux d'occupation de 0% donne un revenu et un cash-flow négatif cohérent", () => {
    const result = computeRentalSimulation({
      prixAchatJpy: 5_000_000,
      monthlyRentJpy: 50_000,
      occupancyRatePercent: 0,
      totalAnnuelJpy: 200_000,
    });
    expect(result.revenuAnnuelBrutJpy).toBe(0);
    expect(result.cashFlowEstimeJpy).toBe(-200_000);
  });
});

describe("MINPAKU_CHECKLIST_TEMPLATE", () => {
  it("n'a aucun identifiant dupliqué", () => {
    const ids = MINPAKU_CHECKLIST_TEMPLATE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("computeMinpakuChecklistSummary", () => {
  it("retourne 0 pour une checklist vide", () => {
    const summary = computeMinpakuChecklistSummary(createEmptyMinpakuChecklist());
    expect(summary.completed).toBe(0);
    expect(summary.total).toBe(MINPAKU_CHECKLIST_TEMPLATE.length);
  });

  it("compte les éléments cochés", () => {
    const state = createEmptyMinpakuChecklist();
    state[MINPAKU_CHECKLIST_TEMPLATE[0].id] = true;
    expect(computeMinpakuChecklistSummary(state).completed).toBe(1);
  });
});

describe("computeDemolitionComparison", () => {
  it("calcule l'écart entre rénovation et démolition", () => {
    const comparison = computeDemolitionComparison(8_000_000, 3_000_000);
    expect(comparison.deltaJpy).toBe(3_000_000 - 8_000_000);
  });
});
