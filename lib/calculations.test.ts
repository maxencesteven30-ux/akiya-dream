import { describe, expect, it } from "vitest";
import {
  calculateAnnualCosts,
  computeAccompanimentFee,
  computeAcquisitionFees,
  computeAgencyFee,
  computeBudget,
  computeBudgetScenarios,
  computeBudgetVerdict,
  computeEstimatedPriceFromSurface,
  computeHiddenCostsTotal,
  computeLegalSetupFee,
  computeMaxAffordablePriceJpy,
  computeRenovationBudget,
  computeRenovationScenarios,
  computeRiskFlags,
  computeSurfaceBasedRenovation,
  EUR_JPY_RATE,
} from "@/lib/calculations";
import type { Region } from "@/lib/types";

const SAMPLE_REGION_LOW_RISK: Region = {
  prefecture: "Fukuoka_Periph",
  medianPriceJpy: 4_800_000,
  medianAgeYears: 35,
  pre1981Percent: 30,
  subsidyMaxJpy: 0,
  recommendationLevel: "B",
};

const SAMPLE_REGION_HIGH_RISK: Region = {
  prefecture: "Shimane",
  medianPriceJpy: 3_000_000,
  medianAgeYears: 50,
  pre1981Percent: 61,
  subsidyMaxJpy: 0,
  recommendationLevel: "C",
};

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

  it("sans accompagnement ni traduction (défaut), accompagnement et traduction sont à 0 (non-régression)", () => {
    const fees = computeAcquisitionFees(3_000_000, "solo");
    expect(fees.accompagnement).toBe(0);
    expect(fees.traduction).toBe(0);
    expect(fees.total).toBeCloseTo(615_000, 6);
  });

  it("ajoute le forfait curation (milieu de fourchette 200k-300k)", () => {
    const fees = computeAcquisitionFees(3_000_000, "solo", "curation");
    expect(fees.accompagnement).toBe(250_000);
    expect(fees.total).toBeCloseTo(615_000 + 250_000, 6);
  });

  it("ajoute le forfait clé en main (milieu de fourchette 500k-1M)", () => {
    const fees = computeAcquisitionFees(3_000_000, "solo", "cle_en_main");
    expect(fees.accompagnement).toBe(750_000);
    expect(fees.total).toBeCloseTo(615_000 + 750_000, 6);
  });

  it("ajoute la traduction uniquement si explicitement demandée", () => {
    const withoutTranslation = computeAcquisitionFees(3_000_000, "solo", "autonome", false);
    const withTranslation = computeAcquisitionFees(3_000_000, "solo", "autonome", true);
    expect(withoutTranslation.traduction).toBe(0);
    expect(withTranslation.traduction).toBeGreaterThan(0);
    expect(withTranslation.total).toBeCloseTo(
      withoutTranslation.total + withTranslation.traduction,
      6,
    );
  });
});

describe("computeAccompanimentFee", () => {
  it("retourne les 3 niveaux attendus, déterministes", () => {
    expect(computeAccompanimentFee("autonome")).toBe(0);
    expect(computeAccompanimentFee("curation")).toBe(250_000);
    expect(computeAccompanimentFee("cle_en_main")).toBe(750_000);
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

  it("intègre le forfait clé en main et la traduction dans le total", () => {
    const sansAccompagnement = computeBudget(3_000_000, "solo", "leger");
    const avecAccompagnement = computeBudget(
      3_000_000,
      "solo",
      "leger",
      null,
      "cle_en_main",
      true,
    );
    const surcout =
      avecAccompagnement.acquisitionFees.accompagnement +
      avecAccompagnement.acquisitionFees.traduction;
    expect(avecAccompagnement.totalProjetJpy).toBeCloseTo(
      sansAccompagnement.totalProjetJpy + surcout,
      6,
    );
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

  it("sans association de quartier ni région neigeuse (défaut), chonaikai/déneigement à 0 (non-régression)", () => {
    const costs = calculateAnnualCosts(3_000_000, "solo");
    expect(costs.chonaikaiJpy).toBe(0);
    expect(costs.deneigementJpy).toBe(0);
    expect(costs.totalAnnuelJpy).toBeCloseTo(175_500, 6);
  });

  it("ajoute la cotisation Chōnaikai si demandée", () => {
    const costs = calculateAnnualCosts(3_000_000, "solo", true, false);
    expect(costs.chonaikaiJpy).toBe(21_000);
    expect(costs.totalAnnuelJpy).toBeCloseTo(175_500 + 21_000, 6);
  });

  it("ajoute le déneigement pour une région neigeuse", () => {
    const costs = calculateAnnualCosts(3_000_000, "solo", false, true);
    expect(costs.deneigementJpy).toBe(100_000);
    expect(costs.totalAnnuelJpy).toBeCloseTo(175_500 + 100_000, 6);
  });

  it("cumule les deux si les deux sont activés", () => {
    const costs = calculateAnnualCosts(3_000_000, "solo", true, true);
    expect(costs.totalAnnuelJpy).toBeCloseTo(175_500 + 21_000 + 100_000, 6);
  });
});

describe("computeBudgetVerdict", () => {
  it("soustrait la réserve de sécurité du capital pour obtenir le budget disponible", () => {
    const verdict = computeBudgetVerdict(58_400, 80_000, 15_000);
    expect(verdict.budgetDisponibleEur).toBe(65_000);
  });

  it("verdict viable quand la marge dépasse 10% du budget nécessaire", () => {
    // Exemple du cahier des charges : 58 400 nécessaire, 65 000 disponible
    const verdict = computeBudgetVerdict(58_400, 65_000, 0);
    expect(verdict.margeEur).toBeCloseTo(6_600, 6);
    expect(verdict.verdict).toBe("viable");
  });

  it("verdict tendu quand la marge est positive mais sous 10%", () => {
    // Exemple du cahier des charges : 63 900 nécessaire, 65 000 disponible
    const verdict = computeBudgetVerdict(63_900, 65_000, 0);
    expect(verdict.margeEur).toBeCloseTo(1_100, 6);
    expect(verdict.verdict).toBe("tendu");
  });

  it("verdict non viable quand la marge est négative", () => {
    // Exemple du cahier des charges : 72 000 nécessaire, 65 000 disponible
    const verdict = computeBudgetVerdict(72_000, 65_000, 0);
    expect(verdict.margeEur).toBeCloseTo(-7_000, 6);
    expect(verdict.verdict).toBe("non_viable");
  });
});

describe("computeRenovationScenarios", () => {
  it("applique +0% / +10% / +20% sur l'estimation de base (exemple du cahier des charges)", () => {
    // Travaux standard = 8 000 000 JPY -> optimiste 8,0M / réaliste 8,8M / prudent 9,6M
    const scenarios = computeRenovationScenarios("standard");
    expect(scenarios.optimisteJpy).toBe(8_000_000);
    expect(scenarios.realisteJpy).toBeCloseTo(8_800_000, 6);
    expect(scenarios.prudentJpy).toBeCloseTo(9_600_000, 6);
  });
});

describe("computeBudgetScenarios", () => {
  it("retourne 3 scénarios avec le même prix d'achat et les mêmes frais d'acquisition", () => {
    const scenarios = computeBudgetScenarios(3_000_000, "solo", "standard");
    expect(scenarios).toHaveLength(3);

    const [optimiste, realiste, prudent] = scenarios;
    expect(optimiste.label).toBe("optimiste");
    expect(realiste.label).toBe("realiste");
    expect(prudent.label).toBe("prudent");

    // Seul le poste travaux varie entre scénarios : acquisition inchangée (615 000)
    expect(optimiste.totalProjetJpy).toBeCloseTo(11_615_000, 6);
    expect(realiste.totalProjetJpy).toBeCloseTo(12_415_000, 6); // +800 000
    expect(prudent.totalProjetJpy).toBeCloseTo(13_215_000, 6); // +1 600 000
  });

  it("sans subvention (défaut), travauxJpy et netTravauxJpy sont identiques (non-régression)", () => {
    const [optimiste] = computeBudgetScenarios(3_000_000, "solo", "standard");
    expect(optimiste.subsidiesJpy).toBe(0);
    expect(optimiste.netTravauxJpy).toBe(optimiste.travauxJpy);
  });

  it("une subvention réduit le net à payer et le total, sans modifier le brut travauxJpy", () => {
    const [optimiste] = computeBudgetScenarios(3_000_000, "solo", "standard", null, 2_000_000);
    expect(optimiste.travauxJpy).toBe(8_000_000); // brut inchangé
    expect(optimiste.subsidiesJpy).toBe(2_000_000);
    expect(optimiste.netTravauxJpy).toBe(6_000_000);
    expect(optimiste.totalProjetJpy).toBeCloseTo(11_615_000 - 2_000_000, 6);
  });

  it("une subvention supérieure aux travaux ne produit jamais un net négatif", () => {
    const [optimiste] = computeBudgetScenarios(3_000_000, "solo", "leger", null, 50_000_000);
    expect(optimiste.netTravauxJpy).toBe(0);
    expect(optimiste.totalProjetJpy).toBeCloseTo(3_000_000 + 615_000, 6);
  });
});

describe("computeRiskFlags", () => {
  it("ne retourne aucun point de vigilance sans région (pas de données)", () => {
    expect(computeRiskFlags("solo", "leger", null)).toEqual([]);
  });

  it("signale la clarification juridique uniquement pour le profil à deux", () => {
    const solo = computeRiskFlags("solo", "leger", null);
    const duo = computeRiskFlags("duo", "leger", null);
    expect(solo.some((f) => f.key === "duo-ownership")).toBe(false);
    expect(duo.some((f) => f.key === "duo-ownership")).toBe(true);
  });

  it("signale la marge d'imprévus uniquement pour les travaux lourds", () => {
    const standard = computeRiskFlags("solo", "standard", null);
    const lourd = computeRiskFlags("solo", "lourd", null);
    expect(standard.some((f) => f.key === "heavy-renovation")).toBe(false);
    expect(lourd.some((f) => f.key === "heavy-renovation")).toBe(true);
  });

  it("signale le bâti ancien seulement au dessus du seuil de 40%", () => {
    const lowRisk = computeRiskFlags("solo", "leger", SAMPLE_REGION_LOW_RISK);
    const highRisk = computeRiskFlags("solo", "leger", SAMPLE_REGION_HIGH_RISK);
    expect(lowRisk.some((f) => f.key === "old-construction")).toBe(false);
    expect(highRisk.some((f) => f.key === "old-construction")).toBe(true);
    expect(highRisk.find((f) => f.key === "old-construction")?.message).toContain("61%");
  });

  it("signale l'accès aux services dès qu'une région est sélectionnée", () => {
    const flags = computeRiskFlags("solo", "leger", SAMPLE_REGION_LOW_RISK);
    expect(flags.some((f) => f.key === "rural-access")).toBe(true);
  });

  it("utilise l'année réelle du bien plutôt que la moyenne régionale quand elle est fournie", () => {
    // Région à faible risque (30% pré-1981) mais bien réel construit en 1975 -> flag précis
    const flags = computeRiskFlags("solo", "leger", SAMPLE_REGION_LOW_RISK, 1975);
    expect(flags.some((f) => f.key === "old-construction")).toBe(false);
    expect(flags.some((f) => f.key === "old-construction-house")).toBe(true);
    expect(flags.find((f) => f.key === "old-construction-house")?.message).toContain("1975");
  });

  it("ne signale rien sur l'ancienneté si l'année réelle du bien est récente, même en région à risque", () => {
    const flags = computeRiskFlags("solo", "leger", SAMPLE_REGION_HIGH_RISK, 2005);
    expect(flags.some((f) => f.key === "old-construction")).toBe(false);
    expect(flags.some((f) => f.key === "old-construction-house")).toBe(false);
  });

  it("signale l'éloignement de la gare avec la distance réelle plutôt que le rappel générique", () => {
    const flags = computeRiskFlags("solo", "leger", SAMPLE_REGION_LOW_RISK, null, 20);
    expect(flags.some((f) => f.key === "rural-access")).toBe(false);
    expect(flags.some((f) => f.key === "isolated-station-distance")).toBe(true);
    expect(flags.find((f) => f.key === "isolated-station-distance")?.message).toContain("20 km");
  });

  it("ne signale pas d'éloignement si la distance réelle est sous le seuil", () => {
    const flags = computeRiskFlags("solo", "leger", SAMPLE_REGION_LOW_RISK, null, 5);
    expect(flags.some((f) => f.key === "isolated-station-distance")).toBe(false);
    expect(flags.some((f) => f.key === "rural-access")).toBe(false);
  });
});

describe("computeMaxAffordablePriceJpy", () => {
  it("régime A (prix ≤ 8M) : retrouve un prix cohérent avec computeBudget", () => {
    const maxPrice = computeMaxAffordablePriceJpy(10_000_000, "solo", 3_000_000);
    expect(maxPrice).toBe(6_230_000);

    // Vérifie que ce prix reste bien sous le budget cible, et qu'un cran
    // au-dessus (10 000 JPY) le dépasserait (borne de l'arrondi par défaut).
    const budgetAtMax = computeBudget(maxPrice!, "solo", "leger", null);
    // On recalcule manuellement le total avec les travaux fournis (3M) car
    // "leger" correspond déjà à 3M dans RENOVATION_BUDGET_JPY.
    expect(budgetAtMax.totalProjetJpy).toBeLessThanOrEqual(10_000_000);

    const budgetOneStepAbove = computeBudget(maxPrice! + 10_000, "solo", "leger", null);
    expect(budgetOneStepAbove.totalProjetJpy).toBeGreaterThan(10_000_000);
  });

  it("régime B (prix > 8M) : bascule de formule cohérente avec computeAcquisitionFees", () => {
    const maxPrice = computeMaxAffordablePriceJpy(30_000_000, "investisseur", 5_000_000);
    expect(maxPrice).toBe(22_750_000);
    expect(maxPrice!).toBeGreaterThan(8_000_000);

    const fees = computeAcquisitionFees(maxPrice!, "investisseur");
    const total = maxPrice! + fees.total + 5_000_000;
    expect(total).toBeLessThanOrEqual(30_000_000);

    const feesOneStepAbove = computeAcquisitionFees(maxPrice! + 10_000, "investisseur");
    const totalOneStepAbove = maxPrice! + 10_000 + feesOneStepAbove.total + 5_000_000;
    expect(totalOneStepAbove).toBeGreaterThan(30_000_000);
  });

  it("budget insuffisant : retourne null plutôt qu'un prix négatif", () => {
    expect(computeMaxAffordablePriceJpy(1_000_000, "solo", 3_000_000)).toBeNull();
  });

  it("est déterministe et ne produit jamais NaN", () => {
    const a = computeMaxAffordablePriceJpy(10_000_000, "duo", 2_000_000);
    const b = computeMaxAffordablePriceJpy(10_000_000, "duo", 2_000_000);
    expect(a).toBe(b);
    expect(Number.isNaN(a)).toBe(false);
  });

  it("des frais fixes additionnels (accompagnement/traduction) réduisent le prix maximum", () => {
    const sansExtra = computeMaxAffordablePriceJpy(10_000_000, "solo", 3_000_000);
    const avecExtra = computeMaxAffordablePriceJpy(10_000_000, "solo", 3_000_000, 850_000);
    expect(avecExtra!).toBeLessThan(sansExtra!);
    // La réduction du prix maximum doit être proche de 850 000/(1+taxe),
    // à l'arrondi de la fonction près (deux arrondis à 10 000 JPY cumulés).
    const expectedDelta = 850_000 / (1 + 0.045);
    expect(Math.abs(sansExtra! - avecExtra! - expectedDelta)).toBeLessThan(20_000);
  });
});

describe("computeSurfaceBasedRenovation", () => {
  it("calcule isolation + HVAC au m² et une majoration structurelle pour PRE_1981", () => {
    // 80 m², 1975 -> PRE_1981 : (12000+8000)*80 = 1_600_000 isolation+HVAC + 4_000_000 structurel
    const result = computeSurfaceBasedRenovation(1975, 80);
    expect(result.eraCode).toBe("PRE_1981");
    expect(result.isolationJpy).toBe(960_000);
    expect(result.hvacJpy).toBe(640_000);
    expect(result.majorationStructurelleJpy).toBe(4_000_000);
    expect(result.totalJpy).toBe(5_600_000);
  });

  it("n'applique aucune majoration structurelle pour POST_1981", () => {
    const result = computeSurfaceBasedRenovation(1990, 80);
    expect(result.eraCode).toBe("POST_1981");
    expect(result.majorationStructurelleJpy).toBe(0);
    expect(result.isolationJpy).toBe(640_000);
    expect(result.hvacJpy).toBe(480_000);
    expect(result.totalJpy).toBe(1_120_000);
  });

  it("n'applique aucune majoration structurelle pour POST_2000", () => {
    const result = computeSurfaceBasedRenovation(2010, 80);
    expect(result.eraCode).toBe("POST_2000");
    expect(result.majorationStructurelleJpy).toBe(0);
    expect(result.totalJpy).toBe((3000 + 4000) * 80);
  });

  it("est déterministe et ne divise jamais par zéro (surface nulle)", () => {
    const result = computeSurfaceBasedRenovation(1975, 0);
    expect(result.isolationJpy).toBe(0);
    expect(result.hvacJpy).toBe(0);
    expect(result.majorationStructurelleJpy).toBe(4_000_000);
    expect(result.totalJpy).toBe(4_000_000);
    expect(Number.isNaN(result.totalJpy)).toBe(false);
  });
});

describe("computeEstimatedPriceFromSurface", () => {
  it("multiplie la surface par le prix moyen au m² de l'ère correspondante", () => {
    expect(computeEstimatedPriceFromSurface(1975, 80)).toBe(2_000_000); // PRE_1981: 25000*80
    expect(computeEstimatedPriceFromSurface(1990, 80)).toBe(2_800_000); // POST_1981: 35000*80
    expect(computeEstimatedPriceFromSurface(2010, 80)).toBe(4_000_000); // POST_2000: 50000*80
  });
});

describe("computeBudget avec affinage surface (refinement)", () => {
  it("sans refinement, se comporte exactement comme avant (non-régression)", () => {
    const budget = computeBudget(3_000_000, "solo", "leger");
    expect(budget.travauxJpy).toBe(3_000_000);
    expect(budget.surfaceBasedRenovation).toBeNull();
    expect(budget.totalProjetJpy).toBeCloseTo(6_615_000, 6);
  });

  it("avec surface connue, l'enveloppe travaux devient proportionnelle à la taille (68 000 JPY/m² pour leger)", () => {
    const budget = computeBudget(3_000_000, "solo", "leger", {
      constructionYear: 1975,
      surfaceM2: 80,
    });
    expect(budget.travauxJpy).toBe(5_440_000); // 68_000 * 80
    expect(budget.totalProjetJpy).toBeCloseTo(3_000_000 + 615_000 + 5_440_000, 6);
  });

  it("la surface seule (sans année de construction) suffit à proportionner l'enveloppe", () => {
    const budget = computeBudget(3_000_000, "solo", "leger", {
      constructionYear: null,
      surfaceM2: 80,
    });
    expect(budget.travauxJpy).toBe(5_440_000);
    expect(budget.surfaceBasedRenovation).toBeNull(); // affinage informationnel non calculable sans année
  });

  it("l'affinage isolation/HVAC/sismique reste informationnel, jamais sommé dans travauxJpy", () => {
    const budget = computeBudget(3_000_000, "solo", "leger", {
      constructionYear: 1975,
      surfaceM2: 80,
    });
    expect(budget.surfaceBasedRenovation).not.toBeNull();
    expect(budget.surfaceBasedRenovation?.totalJpy).toBe(5_600_000); // cf. computeSurfaceBasedRenovation
    // travauxJpy (5_440_000) et surfaceBasedRenovation.totalJpy (5_600_000) sont
    // deux chiffres différents et indépendants -- jamais confondus ni sommés.
    expect(budget.travauxJpy).not.toBe(budget.surfaceBasedRenovation?.totalJpy);
  });

  it("une petite maison et une grande maison au même niveau de travaux n'ont plus la même enveloppe", () => {
    const petite = computeBudget(3_000_000, "solo", "standard", { constructionYear: null, surfaceM2: 40 });
    const grande = computeBudget(3_000_000, "solo", "standard", { constructionYear: null, surfaceM2: 400 });
    expect(petite.travauxJpy).toBe(6_040_000); // 151_000 * 40
    expect(grande.travauxJpy).toBe(60_400_000); // 151_000 * 400
    expect(grande.travauxJpy).toBeGreaterThan(petite.travauxJpy * 5);
  });

  it("une surface à zéro ou négative retombe sur le forfait générique, jamais 0 JPY ni NaN", () => {
    const budget = computeBudget(3_000_000, "solo", "leger", {
      constructionYear: 1990,
      surfaceM2: 0,
    });
    expect(Number.isNaN(budget.totalProjetJpy)).toBe(false);
    expect(budget.travauxJpy).toBe(3_000_000); // forfait leger, surface 0 traitée comme non exploitable
  });
});

describe("computeBudgetScenarios avec refinement", () => {
  it("sans refinement, se comporte exactement comme avant (non-régression)", () => {
    const scenarios = computeBudgetScenarios(3_000_000, "solo", "standard");
    expect(scenarios[0].travauxJpy).toBe(8_000_000);
  });

  it("avec surface connue, applique les scénarios +0/+10/+20% sur l'enveloppe proportionnelle", () => {
    const scenarios = computeBudgetScenarios(3_000_000, "solo", "standard", {
      constructionYear: 1975,
      surfaceM2: 80,
    });
    // base proportionnelle = 151_000 * 80 = 12_080_000 (plus le forfait générique)
    expect(scenarios[0].travauxJpy).toBe(12_080_000);
    expect(scenarios[1].travauxJpy).toBeCloseTo(13_288_000, 6);
    expect(scenarios[2].travauxJpy).toBeCloseTo(14_496_000, 6);
  });
});

describe("computeHiddenCostsTotal", () => {
  it("retourne 0 sans sélection (défaut)", () => {
    expect(computeHiddenCostsTotal()).toBe(0);
  });

  it("retourne 0 avec toutes les options désactivées", () => {
    expect(
      computeHiddenCostsTotal({
        surveyBoundary: false,
        pestTreatment: false,
        septicTankService: false,
        backTaxesNegotiation: false,
      }),
    ).toBe(0);
  });

  it("additionne les milieux de fourchette des options activées", () => {
    const total = computeHiddenCostsTotal({
      surveyBoundary: true,
      pestTreatment: false,
      septicTankService: true,
      backTaxesNegotiation: false,
    });
    // bornage 275 000 + fosse septique 100 000
    expect(total).toBe(375_000);
  });

  it("additionne les 4 options si toutes activées", () => {
    const total = computeHiddenCostsTotal({
      surveyBoundary: true,
      pestTreatment: true,
      septicTankService: true,
      backTaxesNegotiation: true,
    });
    // 275 000 + 325 000 + 100 000 + 150 000
    expect(total).toBe(850_000);
  });
});

describe("computeBudget avec frais cachés", () => {
  it("sans hiddenCosts (défaut), imprevusJpy est 0 (non-régression)", () => {
    const budget = computeBudget(3_000_000, "solo", "leger");
    expect(budget.imprevusJpy).toBe(0);
    expect(budget.totalProjetJpy).toBeCloseTo(6_615_000, 6);
  });

  it("ajoute les imprévus sélectionnés au total, sans modifier travauxJpy", () => {
    const budget = computeBudget(3_000_000, "solo", "leger", null, "autonome", false, {
      surveyBoundary: true,
      pestTreatment: false,
      septicTankService: false,
      backTaxesNegotiation: false,
    });
    expect(budget.imprevusJpy).toBe(275_000);
    expect(budget.travauxJpy).toBe(3_000_000);
    expect(budget.totalProjetJpy).toBeCloseTo(6_615_000 + 275_000, 6);
  });
});

describe("computeBudgetScenarios avec frais cachés", () => {
  it("ajoute le même forfait d'imprévus (fixe) à chaque scénario", () => {
    const scenarios = computeBudgetScenarios(
      3_000_000,
      "solo",
      "standard",
      null,
      0,
      "autonome",
      false,
      { surveyBoundary: false, pestTreatment: false, septicTankService: true, backTaxesNegotiation: true },
    );
    for (const scenario of scenarios) {
      expect(scenario.imprevusJpy).toBe(250_000); // 100 000 + 150 000
    }
    expect(scenarios[0].totalProjetJpy).toBeCloseTo(11_615_000 + 250_000, 6);
    expect(scenarios[2].totalProjetJpy).toBeCloseTo(13_215_000 + 250_000, 6);
  });
});
