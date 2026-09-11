import { computeBudget, computeBudgetVerdict } from "@/lib/calculations";
import { computeOpportunityScore } from "@/lib/opportunity";
import type { Region, RenovationLevel, SavedProject } from "@/lib/types";

export type FeasibilityVerdict = "✅ Oui" | "⚠️ Moyen" | "❌ Non";

export interface PropertyComparisonInput {
  property: SavedProject;
  region: Region | null;
  capitalDisponibleEur: number | null;
  reserveSecuriteEur: number | null;
}

export interface PropertyComparison {
  propertyId: string;
  name: string;
  totalBudgetJpy: number;
  totalBudgetEur: number;
  // null uniquement si les données nécessaires (région + bien réel avec état/
  // année) ne sont pas disponibles pour ce projet — jamais une note inventée.
  opportunityScore: number | null;
  // null uniquement si le capital/la réserve ne sont pas renseignés — on ne
  // peut pas juger une faisabilité budgétaire sans budget utilisateur.
  feasibilityVerdict: FeasibilityVerdict | null;
  renovationDurationMonths: number;
}

// Estimation indicative de durée de chantier par niveau de travaux — une
// hypothèse de gestion explicite (même principe que RENOVATION_BUDGET_JPY),
// pas une donnée mesurée pour un chantier précis.
const RENOVATION_DURATION_MONTHS: Record<RenovationLevel, number> = {
  leger: 2,
  standard: 4,
  lourd: 8,
};

function computeFeasibilityVerdict(
  totalProjetEur: number,
  capitalDisponibleEur: number | null,
  reserveSecuriteEur: number | null,
): FeasibilityVerdict | null {
  if (capitalDisponibleEur === null || reserveSecuriteEur === null) return null;
  const verdict = computeBudgetVerdict(totalProjetEur, capitalDisponibleEur, reserveSecuriteEur);
  if (verdict.verdict === "viable") return "✅ Oui";
  if (verdict.verdict === "tendu") return "⚠️ Moyen";
  return "❌ Non";
}

export function compareProperties(inputs: PropertyComparisonInput[]): PropertyComparison[] {
  const comparisons = inputs.map(
    ({ property, region, capitalDisponibleEur, reserveSecuriteEur }) => {
      const budget = computeBudget(property.housePriceJpy, property.profile, property.renovationLevel);

      const opportunityScore =
        region && property.realListing
          ? computeOpportunityScore({
              prixAchatJpy: property.housePriceJpy,
              profile: property.profile,
              renovationLevel: property.renovationLevel,
              region,
              listing: property.realListing,
            }).score
          : null;

      return {
        propertyId: property.id,
        name: property.name,
        totalBudgetJpy: budget.totalProjetJpy,
        totalBudgetEur: budget.totalProjetEur,
        opportunityScore,
        feasibilityVerdict: computeFeasibilityVerdict(
          budget.totalProjetEur,
          capitalDisponibleEur,
          reserveSecuriteEur,
        ),
        renovationDurationMonths: RENOVATION_DURATION_MONTHS[property.renovationLevel],
      };
    },
  );

  // Tri décroissant par note d'opportunité connue ; les biens sans note
  // (données insuffisantes) sont placés après, jamais devant un score réel.
  return [...comparisons].sort((a, b) => {
    if (a.opportunityScore === null && b.opportunityScore === null) return 0;
    if (a.opportunityScore === null) return 1;
    if (b.opportunityScore === null) return -1;
    return b.opportunityScore - a.opportunityScore;
  });
}

export function getBestDeal(comparisons: PropertyComparison[]): PropertyComparison | null {
  const eligible = comparisons.filter(
    (c): c is PropertyComparison & { opportunityScore: number } =>
      c.opportunityScore !== null && c.feasibilityVerdict === "✅ Oui",
  );
  if (eligible.length === 0) return null;

  return eligible.reduce((best, current) =>
    current.opportunityScore > best.opportunityScore ? current : best,
  );
}
