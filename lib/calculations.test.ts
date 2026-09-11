import { describe, expect, it } from "vitest";
import {
  calculateAnnualCosts,
  computeAcquisitionFees,
  computeAgencyFee,
  computeBudget,
  computeLegalSetupFee,
  computeRenovationBudget,
  EUR_JPY_RATE,
} from "@/lib/calculations";

describe("computeAgencyFee", () => {
  it("applique le forfait plafonné en dessous du seuil de 8M JPY", () => {
    expect(computeAgencyFee(3_000_000)).toBe(330_000);
    expect(computeAgencyFee(8_000_000)).toBe(330_000);
  });

  it("applique la formule légale + TVA au dessus du seuil de 8M JPY", () => {
    // (9_000_000 * 0.03 + 60_000) * 1.10 = 363_000
    expect(computeAgencyFee(9_000_000)).toBeCloseTo(363_000, 6);
  });
});

describe("computeLegalSetupFee", () => {
  it("n'ajoute rien pour un acheteur solo", () => {
    expect(computeLegalSetupFee("solo")).toBe(0);
  });

  it("ajoute 350 000 JPY pour un profil à deux (SCI)", () => {
    expect(computeLegalSetupFee("duo")).toBe(350_000);
  });

  it("ajoute 250 000 JPY pour un investisseur (Gōdō Kaisha)", () => {
    expect(computeLegalSetupFee("investisseur")).toBe(250_000);
  });
});

describe("computeAcquisitionFees", () => {
  it("calcule le détail complet pour un profil solo sous le seuil", () => {
    const fees = computeAcquisitionFees(3_000_000, "solo");
    expect(fees.agence).toBe(330_000);
    expect(fees.juriste).toBe(150_000);
    expect(fees.taxes).toBeCloseTo(135_000, 6); // 3_000_000 * 0.045
    expect(fees.montageJuridique).toBe(0);
    expect(fees.total).toBeCloseTo(615_000, 6);
  });

  it("calcule le détail complet pour un investisseur au dessus du seuil", () => {
    const fees = computeAcquisitionFees(9_000_000, "investisseur");
    expect(fees.agence).toBeCloseTo(363_000, 6);
    expect(fees.juriste).toBe(150_000);
    expect(fees.taxes).toBeCloseTo(405_000, 6); // 9_000_000 * 0.045
    expect(fees.montageJuridique).toBe(250_000);
    expect(fees.total).toBeCloseTo(1_168_000, 6);
  });
});

describe("computeRenovationBudget", () => {
  it("retourne les montants fixes par palier", () => {
    expect(computeRenovationBudget("leger")).toBe(3_000_000);
    expect(computeRenovationBudget("standard")).toBe(8_000_000);
    expect(computeRenovationBudget("lourd")).toBe(15_000_000);
  });
});

describe("computeBudget", () => {
  it("agrège prix, frais et travaux (solo, 3M, léger)", () => {
    const budget = computeBudget(3_000_000, "solo", "leger");
    expect(budget.totalAcquisitionJpy).toBeCloseTo(3_615_000, 6);
    expect(budget.totalProjetJpy).toBeCloseTo(6_615_000, 6);
    expect(budget.totalProjetEur).toBeCloseTo(6_615_000 / EUR_JPY_RATE, 6);
  });

  it("agrège prix, frais et travaux (investisseur, 9M, lourd)", () => {
    const budget = computeBudget(9_000_000, "investisseur", "lourd");
    // 9_000_000 (prix) + 1_168_000 (frais) + 15_000_000 (travaux)
    expect(budget.totalProjetJpy).toBeCloseTo(25_168_000, 6);
  });
});

describe("calculateAnnualCosts", () => {
  it("n'ajoute pas de frais comptables pour un profil solo", () => {
    const costs = calculateAnnualCosts(3_000_000, "solo");
    expect(costs.comptableJpy).toBe(0);
    // valeur fiscale 1_500_000 -> taxe fonciere 21_000 + urbanisme 4_500
    // + assurance 50_000 + gestion 100_000
    expect(costs.totalAnnuelJpy).toBeCloseTo(175_500, 6);
    expect(costs.coutDixAnsJpy).toBeCloseTo(1_755_000, 6);
  });

  it("ajoute les frais comptables Gōdō Kaisha pour un investisseur", () => {
    const costs = calculateAnnualCosts(3_000_000, "investisseur");
    expect(costs.comptableJpy).toBe(250_000);
    expect(costs.totalAnnuelJpy).toBeCloseTo(425_500, 6);
    expect(costs.coutDixAnsJpy).toBeCloseTo(4_255_000, 6);
  });

  it("n'ajoute pas de frais comptables pour un profil à deux", () => {
    const costs = calculateAnnualCosts(3_000_000, "duo");
    expect(costs.comptableJpy).toBe(0);
  });
});
