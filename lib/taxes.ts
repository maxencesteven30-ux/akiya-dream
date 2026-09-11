import { CITY_PLANNING_TAX_RATE, PROPERTY_TAX_RATE } from "@/lib/calculations";
import { jpyToEur } from "@/lib/data";

// Fine couche au-dessus de lib/calculations.ts — aucune nouvelle donnée
// fiscale, aucun second moteur : réutilise les mêmes taux nationaux déjà
// utilisés par calculateAnnualCosts, simplement exposés séparément (propriété
// vs urbanisme) pour l'affichage dédié de la Projection 10 ans.
export interface AnnualTaxes {
  propertyTaxJpy: number;
  cityPlanningTaxJpy: number;
  totalJpy: number;
}

export function computeAnnualTaxes(assessedValueJpy: number): AnnualTaxes {
  const propertyTaxJpy = assessedValueJpy * PROPERTY_TAX_RATE;
  const cityPlanningTaxJpy = assessedValueJpy * CITY_PLANNING_TAX_RATE;
  return {
    propertyTaxJpy,
    cityPlanningTaxJpy,
    totalJpy: propertyTaxJpy + cityPlanningTaxJpy,
  };
}

export interface CostProjectionPoint {
  year: number;
  cumulativeCostJpy: number;
  cumulativeCostEur: number;
}

// Projection du coût cumulé (achat + travaux + charges annuelles répétées)
// à des jalons donnés — pure arithmétique sur des totaux déjà calculés par
// computeBudget()/computeBudgetScenarios() et calculateAnnualCosts(),
// jamais une nouvelle estimation financière.
export function computeCostProjection(
  initialCostJpy: number,
  annualCostJpy: number,
  years: number[] = [1, 5, 10],
): CostProjectionPoint[] {
  return years.map((year) => {
    const cumulativeCostJpy = initialCostJpy + annualCostJpy * year;
    return {
      year,
      cumulativeCostJpy,
      cumulativeCostEur: jpyToEur(cumulativeCostJpy),
    };
  });
}
