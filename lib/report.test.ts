import { describe, expect, it } from "vitest";
import { computeBudget, computeBudgetScenarios } from "@/lib/calculations";
import { computeOpportunityScore } from "@/lib/opportunity";
import { generateReportPDF, type ReportData } from "@/lib/report";
import type { RealListing, Region, Subsidy } from "@/lib/types";

const REGION: Region = {
  prefecture: "Fukuoka_Periph",
  medianPriceJpy: 4_000_000,
  medianAgeYears: 35,
  pre1981Percent: 30,
  subsidyMaxJpy: 0,
  recommendationLevel: "B",
};

const LISTING: RealListing = {
  name: "Maison test",
  city: "Test",
  latitude: null,
  longitude: null,
  surfaceM2: 80,
  landM2: null,
  constructionYear: 2005,
  stationDistanceKm: null,
  condition: "good",
};

const SUBSIDY: Subsidy = {
  id: "test_subsidy",
  name: "Programme de test",
  prefecture: "Fukuoka_Periph",
  municipality: "Test",
  level: "municipal",
  type: "renovation",
  maxAmountJpy: 1_000_000,
  coveragePercent: 50,
  conditions: ["Condition de test"],
  eligibility: {
    minResidenceYears: null,
    requiresLocalContractor: null,
    requiresAkiyaBank: false,
    ageLimit: null,
  },
  applicationDeadline: "Avant travaux",
  sourceName: "Test",
  sourceUrl: null,
  verifiedAt: "2026-01-01",
  confidence: "verified",
};

function buildReportData(overrides: Partial<ReportData> = {}): ReportData {
  const budget = computeBudget(3_000_000, "solo", "leger");
  const scenarios = computeBudgetScenarios(3_000_000, "solo", "leger");
  const opportunity = computeOpportunityScore({
    prixAchatJpy: 3_000_000,
    profile: "solo",
    renovationLevel: "leger",
    region: REGION,
    listing: LISTING,
  });

  return {
    propertyName: "Maison test",
    prefecture: "Fukuoka_Periph",
    budget,
    scenarios,
    opportunity,
    subsidies: [SUBSIDY],
    ...overrides,
  };
}

describe("generateReportPDF", () => {
  it("ne plante pas avec des données valides et retourne un Blob PDF", async () => {
    const blob = await generateReportPDF(buildReportData());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("fonctionne sans opportunité calculée (bien réel non renseigné)", async () => {
    const blob = await generateReportPDF(buildReportData({ opportunity: null }));
    expect(blob.size).toBeGreaterThan(0);
  });

  it("fonctionne sans aucune subvention", async () => {
    const blob = await generateReportPDF(buildReportData({ subsidies: [] }));
    expect(blob.size).toBeGreaterThan(0);
  });

  it("inclut une page comparateur uniquement si des données de comparaison sont fournies", async () => {
    const withoutComparison = await generateReportPDF(buildReportData());
    const withComparison = await generateReportPDF(
      buildReportData({
        comparison: [
          {
            propertyId: "p1",
            name: "Bien A",
            totalBudgetJpy: 5_000_000,
            totalBudgetEur: 27_900,
            opportunityScore: 7.2,
            feasibilityVerdict: "✅ Oui",
            renovationDurationMonths: 4,
          },
        ],
      }),
    );
    // La page supplémentaire doit produire un PDF plus volumineux.
    expect(withComparison.size).toBeGreaterThan(withoutComparison.size);
  });

  it("fonctionne avec un tableau de comparaison vide (pas de page ajoutée)", async () => {
    const blob = await generateReportPDF(buildReportData({ comparison: [] }));
    expect(blob.size).toBeGreaterThan(0);
  });

  it("fonctionne sans préfecture connue", async () => {
    const blob = await generateReportPDF(buildReportData({ prefecture: null }));
    expect(blob.size).toBeGreaterThan(0);
  });
});
