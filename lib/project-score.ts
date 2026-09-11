import type { RiskFlag } from "@/lib/calculations";
import type { FeasibilityLevel } from "@/lib/opportunity";

// Phase S — Score global du projet (le niveau de risque, réutilisé
// depuis par la Phase U — Centre de décision).
//
// Dérivé par une règle de gestion explicite, jamais un score numérique
// inventé : un point bloquant avéré (due diligence ou budget) suffit à
// classer le risque comme élevé.

export type RiskLevel = "faible" | "moyen" | "eleve";

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  faible: "🟢 Risque faible",
  moyen: "🟠 Risque modéré",
  eleve: "🔴 Risque élevé",
};

export interface RiskInput {
  hasProblem: boolean;
  feasibility: FeasibilityLevel | null;
  riskFlags: RiskFlag[];
}

// Un seul point bloquant avéré (problème de due diligence, ou budget
// personnel insuffisant) suffit à classer le risque comme élevé — comme
// pour le verdict de due diligence (Phase L), un problème confirmé ne doit
// jamais être dilué par ailleurs. Le risque modéré reflète des signaux de
// vigilance (Phase V2) qui restent des points d'attention, pas des
// blocages confirmés.
export function computeRiskLevel(input: RiskInput): RiskLevel {
  if (input.hasProblem || input.feasibility === "insuffisant") return "eleve";
  if (input.riskFlags.length > 0 || input.feasibility === "tendu") return "moyen";
  return "faible";
}
