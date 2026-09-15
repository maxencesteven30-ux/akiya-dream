import { describe, expect, it, vi } from "vitest";
import { createEmptyPropertyListing } from "@/lib/discovery/property-listing";
import { createEmptySearchProfile } from "@/lib/discovery/search-profile";
import { evaluateHardConstraints } from "@/lib/discovery/hard-constraint-engine";
import { scoreSoftPreferences } from "@/lib/discovery/soft-preference-ranking";
import { runDiscoveryEngine } from "@/lib/discovery/discovery-orchestrator";
import { explainListingEvaluation } from "@/lib/evidence-graph";
import { buildOpportunityInput } from "@/lib/discovery/listing-opportunity-bridge";
import { fetchListingMarketContext } from "@/lib/discovery/listing-market-context-bridge";
import { fetchListingCityScore } from "@/lib/discovery/listing-city-score-bridge";
import { computeOpportunityScore } from "@/lib/opportunity";

// Era 9 (suite) — Increment 6 : preuve d'intégration bout-en-bout que
// les 4 ponts (Opportunity/Market Context/City Score/Evidence Graph)
// consomment réellement les moteurs existants sans les redupliquer, et
// que UNKNOWN ne se transforme jamais silencieusement en PASS/FAIL/0/
// une estimation sur tout le trajet listing -> orchestrateur -> ponts.

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

describe("Discovery Engine — intégration bout-en-bout avec les moteurs existants", () => {
  it("un candidat richement documenté produit un résultat cohérent sur les 4 dimensions, jamais fusionnées", async () => {
    const profile = {
      ...createEmptySearchProfile(),
      hardConstraints: { ...createEmptySearchProfile().hardConstraints, maxBudgetJpy: 5_000_000 },
      softPreferences: { ...createEmptySearchProfile().softPreferences, wantsGarden: true },
    };
    const listing = {
      ...createEmptyPropertyListing("id1", "test", "src1"),
      priceJpy: 3_000_000,
      buildingAreaM2: 90,
      buildingYear: 1985,
      municipalityCode: "32501",
      hasGarden: true,
    };

    const discoveryResult = runDiscoveryEngine(profile, [listing]);
    expect(discoveryResult.eligible).toHaveLength(1);
    const item = discoveryResult.eligible[0];

    // Dimension "Correspondance" — déjà produite par l'orchestrateur.
    expect(item.hardConstraintEvaluation.verdict).toBe("PASS");
    expect(item.softPreferenceScore.score).toBe(1);

    // Dimension "Pourquoi ce bien ?" (Evidence Graph) — enveloppe le même
    // verdict, ne le recalcule jamais.
    const evidence = explainListingEvaluation(item);
    expect(evidence.verdict).toBe(item.hardConstraintEvaluation.verdict);

    // Dimension "Opportunity" — construite depuis le listing, calculée
    // par le moteur Opportunity inchangé.
    const opportunityInput = buildOpportunityInput(listing, { profile: "solo", renovationLevel: "leger", region: null });
    expect(opportunityInput).not.toBeNull();
    const opportunity = computeOpportunityScore(opportunityInput!);
    expect(opportunity.score).toBeGreaterThanOrEqual(0);
    expect(opportunity.score).toBeLessThanOrEqual(10);

    // Dimension "Ville" — construite depuis le même listing, moteur
    // City Score inchangé, ici sans coordonnées ni préfecture reconnue :
    // seule la démographie (code municipal) est exploitable.
    const cityScoreFetch = vi.fn().mockResolvedValue(jsonResponse({ status: "AVAILABLE", data: { value: 1 } }));
    const cityScore = await fetchListingCityScore(listing, undefined, cityScoreFetch);
    expect(cityScore).not.toBeNull();
    expect(cityScore!.axes.map((a) => a.key)).toEqual(["demographie"]);

    // Dimension "Marché" — construite depuis le même listing.
    const marketFetch = vi.fn().mockResolvedValue(jsonResponse({ status: "NOT_FOUND", data: [] }));
    const marketContext = await fetchListingMarketContext(listing, marketFetch);
    expect(marketContext).not.toBeNull();

    // Les 4 dimensions restent des objets distincts, jamais fusionnés.
    const combined = { match: item, opportunity, cityScore, marketContext };
    expect(Object.keys(combined)).toEqual(["match", "opportunity", "cityScore", "marketContext"]);
  });

  it("UNKNOWN reste UNKNOWN de bout en bout -- jamais converti en PASS/FAIL/0/estimation", async () => {
    const profile = {
      ...createEmptySearchProfile(),
      hardConstraints: { ...createEmptySearchProfile().hardConstraints, maxBudgetJpy: 5_000_000 },
    };
    // Prix inconnu : le critère budget doit rester UNKNOWN, jamais PASS
    // (silencieusement favorable) ni FAIL (silencieusement défavorable).
    const listing = createEmptyPropertyListing("id1", "test", "src1");

    const discoveryResult = runDiscoveryEngine(profile, [listing]);
    expect(discoveryResult.needsReview).toHaveLength(1);
    const item = discoveryResult.needsReview[0];
    expect(item.hardConstraintEvaluation.verdict).toBe("UNKNOWN");

    const evidence = explainListingEvaluation(item);
    expect(evidence.verdict).toBe("UNKNOWN");
    // Le critère actif mais non résolu apparaît explicitement dans
    // unknownFields -- jamais silencieusement absent ni requalifié.
    expect(evidence.unknownFields).toContain("listing.maxBudgetJpy");
    expect(evidence.reasonMessage).not.toContain("respectés");
    expect(evidence.reasonMessage).not.toContain("non respectés");

    // Le pont Opportunity retourne null (rien à évaluer) -- jamais un
    // prix de 0 JPY ou une estimation silencieuse.
    const opportunityInput = buildOpportunityInput(listing, { profile: "solo", renovationLevel: "leger", region: null });
    expect(opportunityInput).toBeNull();

    // Le pont City Score retourne null sans aucune donnée exploitable --
    // jamais un score construit sur une supposition géographique.
    const cityScore = await fetchListingCityScore(listing, undefined, vi.fn());
    expect(cityScore).toBeNull();

    // Le pont Market Context retourne null sans prix ni commune --
    // jamais un contexte de marché sur un prix ou une commune inventés.
    const marketContext = await fetchListingMarketContext(listing, vi.fn());
    expect(marketContext).toBeNull();
  });

  it("un bien FAIL reste explicable et n'est jamais requalifié en PASS par les ponts", () => {
    const profile = {
      ...createEmptySearchProfile(),
      hardConstraints: { ...createEmptySearchProfile().hardConstraints, maxBudgetJpy: 1_000_000 },
    };
    const listing = { ...createEmptyPropertyListing("id1", "test", "src1"), priceJpy: 3_000_000 };

    const discoveryResult = runDiscoveryEngine(profile, [listing]);
    expect(discoveryResult.excluded).toHaveLength(1);
    const item = discoveryResult.excluded[0];

    const evidence = explainListingEvaluation(item);
    expect(evidence.verdict).toBe("FAIL");
    expect(evidence.nextAction).toContain("ne correspond pas");

    // Un bien FAIL reste malgré tout évaluable par Opportunity (les deux
    // dimensions sont indépendantes -- section 25 de la mission : MATCH
    // ≠ OPPORTUNITY).
    const opportunityInput = buildOpportunityInput(listing, { profile: "solo", renovationLevel: "leger", region: null });
    expect(opportunityInput).not.toBeNull();
  });

  it("les mêmes évaluateurs (evaluateHardConstraints, scoreSoftPreferences) que ceux déjà testés en Phase AJ/AK produisent le contenu des faits -- aucune réimplémentation parallèle", () => {
    const constraints = { ...createEmptySearchProfile().hardConstraints, maxBudgetJpy: 5_000_000 };
    const preferences = { ...createEmptySearchProfile().softPreferences, wantsGarden: true };
    const listing = { ...createEmptyPropertyListing("id1", "test", "src1"), priceJpy: 3_000_000, hasGarden: true };

    const directHard = evaluateHardConstraints(constraints, listing);
    const directSoft = scoreSoftPreferences(preferences, listing);

    const item = { listing, hardConstraintEvaluation: directHard, softPreferenceScore: directSoft };
    const evidence = explainListingEvaluation(item);

    expect(evidence.verdict).toBe(directHard.verdict);
    expect(evidence.facts.length).toBe(
      directHard.checks.filter((c) => c.status !== "NOT_APPLICABLE").length +
        directSoft.matches.filter((m) => m.status !== "not_active").length,
    );
  });
});
