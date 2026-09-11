import type { RiskFlag } from "@/lib/calculations";
import type { CompletionSummary } from "@/lib/due-diligence";
import type { FeasibilityLevel, OpportunityCategory } from "@/lib/opportunity";

// Phase S — Score global du projet.
//
// Un tableau de bord à 4 dimensions, chacune déjà calculée ailleurs dans
// l'application (Phase A/V2 pour Opportunité et Faisabilité, Phase L pour
// Complétude) : cette page ne réinvente aucune note, elle les rassemble et
// ajoute une seule couche neuve — le Risque et le verdict combiné — tous
// deux dérivés par une règle de gestion explicite, jamais un nouveau score
// numérique inventé.

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

export type ProjectVerdictLevel = "vert" | "jaune" | "orange" | "rouge";

export interface ProjectVerdict {
  level: ProjectVerdictLevel;
  message: string;
}

export interface ProjectDashboardInput {
  opportunityCategory: OpportunityCategory;
  risk: RiskLevel;
  completion: CompletionSummary;
}

// Règle de gestion explicite (pas un apprentissage, pas une pondération
// cachée) : le risque élevé prime toujours sur l'opportunité — une bonne
// note ne doit jamais masquer un point bloquant avéré. Ensuite, la note
// d'opportunité fixe la tonalité générale, et le taux de complétude du
// dossier nuance le message sans changer la couleur du verdict (un projet
// intéressant mais mal documenté reste un projet intéressant : il manque
// seulement des vérifications).
export function computeProjectVerdict(input: ProjectDashboardInput): ProjectVerdict {
  const { opportunityCategory, risk, completion } = input;

  if (risk === "eleve") {
    return {
      level: "rouge",
      message:
        "Vigilance requise avant d'aller plus loin : au moins un point bloquant a été identifié (dossier ou budget).",
    };
  }

  if (opportunityCategory === "bonne" || opportunityCategory === "tres_bonne") {
    return completion.percent >= 70
      ? { level: "vert", message: "Projet intéressant et bien documenté." }
      : { level: "vert", message: "Projet intéressant mais encore insuffisamment documenté." };
  }

  if (opportunityCategory === "interessante") {
    return risk === "moyen"
      ? {
          level: "orange",
          message: "Potentiel intéressant, mais plusieurs points restent à vérifier ou à négocier.",
        }
      : { level: "jaune", message: "Potentiel intéressant, à confirmer avant de s'engager." };
  }

  if (opportunityCategory === "risquee") {
    return {
      level: "orange",
      message: "Opportunité risquée : à n'envisager qu'avec des garanties supplémentaires.",
    };
  }

  return {
    level: "rouge",
    message: "Opportunité faible : ce projet mérite d'être reconsidéré.",
  };
}
