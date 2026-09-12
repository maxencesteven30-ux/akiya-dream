import type { CompletionSummary } from "@/lib/due-diligence";
import type { FeasibilityLevel } from "@/lib/opportunity";
import { PIECE_CATEGORY_LABELS, type PieceCategory, type ProjectDocument } from "@/lib/documents";
import { computeVisitProgress, type VisitStageProgress } from "@/lib/visit-checklist";
import type { RealityGateLevel } from "@/lib/reality-gate";
import {
  PROBLEM_ACTION_LABELS,
  computeNextActionV2,
  type NextAction,
  type NextActionInput,
} from "@/lib/next-best-action";
import type { VisitChecklistState } from "@/lib/types";

export { PROBLEM_ACTION_LABELS };
export type { NextAction };

// Phase U — Centre de décision.
//
// N'introduit aucune nouvelle donnée : assemble ce qui existe déjà
// (Opportunité/Faisabilité/Risque de la Phase S, due diligence de la
// Phase L, documents de la Phase O, checklist de visite de la Phase Q)
// pour répondre à "où en est mon projet et dois-je continuer ?". Les deux
// seules pièces neuves sont le statut de visite et la prochaine action,
// tous deux dérivés par règle de gestion explicite — jamais par IA, jamais
// un score inventé pour une donnée inconnue (cf. discipline "donnée
// vérifiée / estimation / inconnue").

export type VisitStatus = "non_commencee" | "en_cours" | "terminee";

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  non_commencee: "Non commencée",
  en_cours: "En cours",
  terminee: "Terminée",
};

// Terminée seulement si l'étape "après visite" est intégralement cochée :
// une visite n'est vraiment exploitée que si ses constats ont été
// reportés (dossier mis à jour, point d'étape enregistré, décision prise).
export function computeVisitStatus(progress: VisitStageProgress[]): VisitStatus {
  const apres = progress.find((p) => p.stage === "apres");
  if (apres && apres.percent === 100) return "terminee";
  const totalCompleted = progress.reduce((sum, p) => sum + p.completed, 0);
  return totalCompleted > 0 ? "en_cours" : "non_commencee";
}

export function computeVisitStatusFromState(state: VisitChecklistState): VisitStatus {
  return computeVisitStatus(computeVisitProgress(state));
}

export interface DocumentsCoverage {
  documentsCount: number;
  coveredCategories: number;
  totalCategories: number;
}

const TOTAL_PIECE_CATEGORIES = Object.keys(PIECE_CATEGORY_LABELS).length;

export function computeDocumentsCoverage(documents: ProjectDocument[]): DocumentsCoverage {
  const covered = new Set<PieceCategory>(documents.map((d) => d.category));
  return {
    documentsCount: documents.length,
    coveredCategories: covered.size,
    totalCategories: TOTAL_PIECE_CATEGORIES,
  };
}

export type DecisionLevel = "pret" | "verifications" | "bloque";

export interface Decision {
  level: DecisionLevel;
  label: string;
}

// Seuil repris de computeDueDiligenceVerdict (Phase L) : cohérence entre
// les deux endroits qui jugent la complétude du dossier.
const DOCUMENTED_THRESHOLD_PERCENT = 70;

// Règle de gestion explicite : le Property Reality Gate (Phase V) prime
// toujours sur tout le reste — un blocage juridique/technique avéré (ou
// même un simple doute non confirmé) ne doit jamais être masqué par une
// bonne note d'opportunité ou un dossier par ailleurs complet. Ensuite, un
// problème de due diligence ou un budget insuffisant bloque également ;
// dossier incomplet ou visite non terminée maintiennent le projet en
// "à vérifier" ; tout au vert donne le feu vert pour une offre.
export function computeDecision(input: {
  realityGateLevel: RealityGateLevel;
  hasProblem: boolean;
  feasibility: FeasibilityLevel | null;
  completion: CompletionSummary;
  visitStatus: VisitStatus;
}): Decision {
  if (input.realityGateLevel === "rouge" || input.hasProblem || input.feasibility === "insuffisant") {
    return { level: "bloque", label: "🔴 Ne pas avancer avant résolution des points bloquants" };
  }
  if (
    input.realityGateLevel === "orange" ||
    input.completion.percent < DOCUMENTED_THRESHOLD_PERCENT ||
    input.visitStatus !== "terminee"
  ) {
    return { level: "verifications", label: "🟠 Continuer les vérifications" };
  }
  return { level: "pret", label: "🟢 Projet prêt pour une offre" };
}

// La logique de priorité vit désormais dans lib/next-best-action.ts (Next
// Best Action Engine v2, hiérarchie explicite à 5 niveaux) — ce point
// d'entrée est conservé pour ne pas casser les appelants existants.
export function computeNextAction(input: NextActionInput): NextAction {
  return computeNextActionV2(input);
}
