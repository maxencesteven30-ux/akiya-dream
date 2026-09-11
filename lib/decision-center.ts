import { CHECKLIST_TEMPLATE } from "@/lib/due-diligence";
import type { CompletionSummary } from "@/lib/due-diligence";
import type { FeasibilityLevel } from "@/lib/opportunity";
import { PIECE_CATEGORY_LABELS, type PieceCategory, type ProjectDocument } from "@/lib/documents";
import { computeVisitProgress, type VisitStageProgress } from "@/lib/visit-checklist";
import {
  LAND_NATURE_PROBLEM_ACTION,
  REALITY_GATE_PROBLEM_ACTIONS,
  REALITY_GATE_TEMPLATE,
  computeLandNatureSeverity,
  type RealityGateLevel,
} from "@/lib/reality-gate";
import type {
  DueDiligenceState,
  LandNature,
  RealityGateState,
  VisitChecklistState,
} from "@/lib/types";

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

// Action concrète suggérée pour chaque élément de due diligence marqué
// "problème détecté" — une règle de gestion explicite et bornée (29
// entrées fixes, jamais générée à la volée), pas une recommandation IA.
export const PROBLEM_ACTION_LABELS: Record<string, string> = {
  batiment_annee: "Faire confirmer l'année de construction réelle auprès du cadastre.",
  batiment_structure: "Faire inspecter la structure par un professionnel avant toute offre.",
  batiment_toiture: "Obtenir un devis toiture avant toute négociation.",
  batiment_fondations: "Faire expertiser les fondations par un professionnel.",
  batiment_humidite: "Faire diagnostiquer l'origine de l'humidité avant de s'engager.",
  batiment_termites: "Faire réaliser un diagnostic termites par un professionnel agréé.",
  batiment_isolation: "Obtenir un devis de mise aux normes d'isolation.",
  batiment_electricite: "Faire vérifier l'installation électrique par un électricien.",
  batiment_plomberie: "Faire vérifier la plomberie par un professionnel.",
  batiment_hvac: "Obtenir un devis de remise aux normes du chauffage/climatisation.",
  juridique_proprietaire: "Faire confirmer l'identité du propriétaire actuel avec un shihō shoshi.",
  juridique_cadastre: "Faire vérifier la situation cadastrale avec un shihō shoshi.",
  juridique_servitudes: "Faire lister les servitudes existantes par un professionnel.",
  juridique_acces: "Faire confirmer les droits d'accès légaux au terrain.",
  juridique_arrieres: "Faire vérifier l'absence d'arriérés (taxes, charges) avant toute offre.",
  juridique_statut_terrain: "Faire clarifier le statut du terrain avec un shihō shoshi.",
  juridique_restrictions: "Faire vérifier les restrictions d'urbanisme applicables.",
  terrain_risques_naturels: "Consulter la carte des risques naturels (hazard map) de la municipalité.",
  terrain_acces: "Faire vérifier l'accès légal et physique au terrain.",
  terrain_pente: "Faire évaluer les risques liés à la pente du terrain.",
  terrain_limites: "Faire clarifier les limites de propriété avec un géomètre.",
  terrain_bornage: "Faire réaliser un bornage du terrain.",
  terrain_assainissement: "Obtenir un devis assainissement.",
  vie_locale_gare: "Mesurer la distance réelle à pied jusqu'à la gare.",
  vie_locale_commerces: "Vérifier l'accès aux commerces de première nécessité.",
  vie_locale_hopital: "Vérifier la distance et l'accès aux soins d'urgence.",
  vie_locale_dechets: "Se renseigner sur les règles de collecte des déchets locales.",
  vie_locale_chonaikai: "Se renseigner sur les obligations de l'association de quartier (Chōnaikai).",
  vie_locale_deneigement: "Se renseigner sur les modalités de déneigement local.",
};

export interface NextAction {
  message: string;
  reason: string;
}

// Priorité déterministe et fixe (jamais un classement appris) : un
// blocage juridique/technique avéré (terrain agricole, élément Reality
// Gate confirmé "problème") prime sur tout le reste — y compris sur un
// problème de due diligence, car un bien juridiquement bloqué n'a pas
// besoin d'être négocié ou rénové. Vient ensuite un doute non confirmé
// (terrain non classé/forestier, élément Reality Gate encore "à
// confirmer") — plus fondamental qu'un dossier de due diligence
// incomplet, car il peut invalider le projet entièrement. Puis : due
// diligence, budget, visite, pièces — dans cet ordre, sans exception.
export function computeNextAction(input: {
  realityGate: RealityGateState;
  landNature: LandNature | null;
  dueDiligence: DueDiligenceState;
  completion: CompletionSummary;
  feasibility: FeasibilityLevel | null;
  visitStatus: VisitStatus;
  documentsCount: number;
}): NextAction {
  const landSeverity = computeLandNatureSeverity(input.landNature);
  if (landSeverity === "probleme") {
    return { message: LAND_NATURE_PROBLEM_ACTION, reason: "Terrain agricole soumis à restrictions" };
  }

  const blockingRealityItem = REALITY_GATE_TEMPLATE.find(
    (item) => input.realityGate[item.id] === "probleme",
  );
  if (blockingRealityItem) {
    return {
      message:
        REALITY_GATE_PROBLEM_ACTIONS[blockingRealityItem.id] ??
        `Résoudre le point bloquant : ${blockingRealityItem.label}.`,
      reason: `Problème identifié (Reality Gate) : ${blockingRealityItem.label}`,
    };
  }

  const problemItem = CHECKLIST_TEMPLATE.find((item) => input.dueDiligence[item.id] === "probleme");
  if (problemItem) {
    return {
      message: PROBLEM_ACTION_LABELS[problemItem.id] ?? `Résoudre le point bloquant : ${problemItem.label}.`,
      reason: `Problème détecté : ${problemItem.label}`,
    };
  }

  if (landSeverity === "a_confirmer") {
    return { message: LAND_NATURE_PROBLEM_ACTION, reason: "Nature du terrain non confirmée" };
  }
  const unconfirmedRealityItem = REALITY_GATE_TEMPLATE.find(
    (item) => (input.realityGate[item.id] ?? "a_confirmer") === "a_confirmer",
  );
  if (unconfirmedRealityItem) {
    return {
      message:
        REALITY_GATE_PROBLEM_ACTIONS[unconfirmedRealityItem.id] ??
        `Confirmer : ${unconfirmedRealityItem.label}.`,
      reason: `À confirmer (Reality Gate) : ${unconfirmedRealityItem.label}`,
    };
  }

  if (input.completion.percent < DOCUMENTED_THRESHOLD_PERCENT) {
    return {
      message: `Poursuivre le dossier de due diligence (${input.completion.completed}/${input.completion.total} vérifiés).`,
      reason: "Dossier encore incomplet",
    };
  }
  if (input.feasibility === null) {
    return {
      message: "Renseigner votre budget personnel pour obtenir un verdict de faisabilité.",
      reason: "Budget non renseigné",
    };
  }
  if (input.feasibility === "insuffisant") {
    return {
      message: "Revoir le prix ou le budget : le projet dépasse vos moyens actuels.",
      reason: "Budget insuffisant",
    };
  }
  if (input.feasibility === "tendu") {
    return {
      message: "Le budget est tendu : envisager de négocier le prix.",
      reason: "Budget tendu",
    };
  }
  if (input.visitStatus !== "terminee") {
    return {
      message: "Planifier et effectuer une visite du bien avant de vous engager davantage.",
      reason: "Visite non terminée",
    };
  }
  if (input.documentsCount === 0) {
    return {
      message: "Rassembler les pièces du dossier (annonce, devis, diagnostics).",
      reason: "Aucun document ajouté",
    };
  }
  return {
    message: "Projet prêt pour une offre.",
    reason: "Aucun point bloquant identifié",
  };
}
