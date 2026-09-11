import hiddenCostsData from "@/data/hidden_costs.json";

export interface HiddenCost {
  id: string;
  category: string;
  itemName: string;
  costType: string;
  minJpy: number;
  maxJpy: number;
  description: string;
}

const HIDDEN_COSTS = hiddenCostsData as HiddenCost[];

export function getAllHiddenCosts(): HiddenCost[] {
  return HIDDEN_COSTS;
}

export function getHiddenCost(id: string): HiddenCost {
  const cost = HIDDEN_COSTS.find((c) => c.id === id);
  if (!cost) {
    throw new Error(`Frais caché inconnu dans hidden_costs.json : ${id}`);
  }
  return cost;
}

// Milieu de la fourchette min/max du CSV : hypothèse de gestion explicite
// (même principe que getAgencyServiceMidpoint), pas une donnée mesurée pour
// un bien précis.
export function getHiddenCostMidpoint(id: string): number {
  const cost = getHiddenCost(id);
  return Math.round((cost.minJpy + cost.maxJpy) / 2);
}
