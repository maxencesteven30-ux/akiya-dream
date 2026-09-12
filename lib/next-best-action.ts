import { CHECKLIST_TEMPLATE } from "@/lib/due-diligence";
import type { CompletionSummary } from "@/lib/due-diligence";
import type { FeasibilityLevel } from "@/lib/opportunity";
import {
  LAND_NATURE_PROBLEM_ACTION,
  LAND_NATURE_UNCONFIRMED_ACTION,
  REALITY_GATE_PROBLEM_ACTIONS,
  REALITY_GATE_TEMPLATE,
  computeLandNatureSeverity,
} from "@/lib/reality-gate";
import { sortSignalsByPriority, type Signal } from "@/lib/data-origin";
import type { DueDiligenceState, LandNature, RealityGateState } from "@/lib/types";
import type { VisitStatus } from "@/lib/decision-center";

// Next Best Action Engine v2 — généralise la chaîne de priorité ad hoc de
// la Phase U en une liste explicite de signaux classés selon la
// hiérarchie à 5 niveaux (BLOCKING > CRITICAL_UNKNOWN > DOCUMENTED_RISK >
// MISSING_INFO > OPTIMIZATION), avec traçabilité complète (règle + champs
// utilisés) pour répondre à "pourquoi Akiya Dream me recommande cela ?".
//
// N'introduit aucune nouvelle donnée : les signaux sont dérivés des mêmes
// entrées que l'ancien computeNextAction (Reality Gate, due diligence,
// budget, visite, documents). La non-régression est garantie par les tests
// de decision-center.test.ts, qui continuent de passer via la délégation
// à ce module.

const DOCUMENTED_THRESHOLD_PERCENT = 70;

export interface PrioritizedAction extends Signal {
  message: string;
}

export interface NextActionInput {
  realityGate: RealityGateState;
  landNature: LandNature | null;
  dueDiligence: DueDiligenceState;
  completion: CompletionSummary;
  feasibility: FeasibilityLevel | null;
  visitStatus: VisitStatus;
  documentsCount: number;
}

// Construit la liste complète des signaux actifs pour un projet — utilisé
// à la fois pour déterminer la prochaine action (le signal de plus haute
// priorité) et, plus tard, pour "qu'est-ce qui pourrait changer mon
// verdict ?" (les signaux suivants dans la liste triée).
export function buildNextActionSignals(input: NextActionInput): PrioritizedAction[] {
  const signals: PrioritizedAction[] = [];
  const landSeverity = computeLandNatureSeverity(input.landNature);

  // BLOCKING — problèmes avérés, jamais masqués par le reste.
  if (landSeverity === "probleme") {
    signals.push({
      level: "BLOCKING",
      message: LAND_NATURE_PROBLEM_ACTION,
      reason: {
        ruleId: "land_nature_probleme",
        message: "Terrain agricole soumis à restrictions",
        fieldsUsed: ["landNature"],
      },
    });
  }
  const blockingRealityItem = REALITY_GATE_TEMPLATE.find(
    (item) => input.realityGate[item.id] === "probleme",
  );
  if (blockingRealityItem) {
    signals.push({
      level: "BLOCKING",
      message:
        REALITY_GATE_PROBLEM_ACTIONS[blockingRealityItem.id] ??
        `Résoudre le point bloquant : ${blockingRealityItem.label}.`,
      reason: {
        ruleId: `reality_gate_probleme_${blockingRealityItem.id}`,
        message: `Problème identifié (Reality Gate) : ${blockingRealityItem.label}`,
        fieldsUsed: [`realityGate.${blockingRealityItem.id}`],
      },
    });
  }
  const problemItem = CHECKLIST_TEMPLATE.find((item) => input.dueDiligence[item.id] === "probleme");
  if (problemItem) {
    signals.push({
      level: "BLOCKING",
      message: PROBLEM_ACTION_LABELS[problemItem.id] ?? `Résoudre le point bloquant : ${problemItem.label}.`,
      reason: {
        ruleId: `due_diligence_probleme_${problemItem.id}`,
        message: `Problème détecté : ${problemItem.label}`,
        fieldsUsed: [`dueDiligence.${problemItem.id}`],
      },
    });
  }
  if (input.feasibility === "insuffisant") {
    signals.push({
      level: "BLOCKING",
      message: "Revoir le prix ou le budget : le projet dépasse vos moyens actuels.",
      reason: { ruleId: "budget_insuffisant", message: "Budget insuffisant", fieldsUsed: ["feasibility"] },
    });
  }

  // CRITICAL_UNKNOWN — inconnues qui empêchent un verdict favorable.
  if (landSeverity === "a_confirmer") {
    signals.push({
      level: "CRITICAL_UNKNOWN",
      message: LAND_NATURE_UNCONFIRMED_ACTION,
      reason: {
        ruleId: "land_nature_a_confirmer",
        message: "Nature du terrain non confirmée",
        fieldsUsed: ["landNature"],
      },
    });
  }
  const unconfirmedRealityItem = REALITY_GATE_TEMPLATE.find(
    (item) => (input.realityGate[item.id] ?? "a_confirmer") === "a_confirmer",
  );
  if (unconfirmedRealityItem) {
    signals.push({
      level: "CRITICAL_UNKNOWN",
      message:
        REALITY_GATE_PROBLEM_ACTIONS[unconfirmedRealityItem.id] ??
        `Confirmer : ${unconfirmedRealityItem.label}.`,
      reason: {
        ruleId: `reality_gate_a_confirmer_${unconfirmedRealityItem.id}`,
        message: `À confirmer (Reality Gate) : ${unconfirmedRealityItem.label}`,
        fieldsUsed: [`realityGate.${unconfirmedRealityItem.id}`],
      },
    });
  }
  if (input.feasibility === null) {
    signals.push({
      level: "CRITICAL_UNKNOWN",
      message: "Renseigner votre budget personnel pour obtenir un verdict de faisabilité.",
      reason: { ruleId: "budget_inconnu", message: "Budget non renseigné", fieldsUsed: ["feasibility"] },
    });
  }

  // DOCUMENTED_RISK — un risque connu, documenté, mais pas bloquant.
  if (input.feasibility === "tendu") {
    signals.push({
      level: "DOCUMENTED_RISK",
      message: "Le budget est tendu : envisager de négocier le prix.",
      reason: { ruleId: "budget_tendu", message: "Budget tendu", fieldsUsed: ["feasibility"] },
    });
  }

  // MISSING_INFO — des informations importantes restent à réunir.
  if (input.completion.percent < DOCUMENTED_THRESHOLD_PERCENT) {
    signals.push({
      level: "MISSING_INFO",
      message: `Poursuivre le dossier de due diligence (${input.completion.completed}/${input.completion.total} vérifiés).`,
      reason: {
        ruleId: "dossier_incomplet",
        message: "Dossier encore incomplet",
        fieldsUsed: ["completion.percent"],
      },
    });
  }
  if (input.visitStatus !== "terminee") {
    signals.push({
      level: "MISSING_INFO",
      message: "Planifier et effectuer une visite du bien avant de vous engager davantage.",
      reason: { ruleId: "visite_non_terminee", message: "Visite non terminée", fieldsUsed: ["visitStatus"] },
    });
  }
  if (input.documentsCount === 0) {
    signals.push({
      level: "MISSING_INFO",
      message: "Rassembler les pièces du dossier (annonce, devis, diagnostics).",
      reason: {
        ruleId: "aucun_document",
        message: "Aucun document ajouté",
        fieldsUsed: ["documentsCount"],
      },
    });
  }

  return sortSignalsByPriority(signals);
}

// Action concrète suggérée pour chaque élément de due diligence marqué
// "problème détecté" — une règle de gestion explicite et bornée (29
// entrées fixes, jamais générée à la volée), pas une recommandation IA.
// Dupliqué depuis decision-center.ts pour éviter une dépendance circulaire
// (decision-center.ts délègue maintenant à ce module) ; source de vérité
// unique conservée ici, decision-center.ts la ré-exporte.
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

const READY_ACTION: NextAction = {
  message: "Projet prêt pour une offre.",
  reason: "Aucun point bloquant identifié",
};

// Point d'entrée principal : renvoie l'action de plus haute priorité, ou
// "prêt" si aucun signal n'est actif.
export function computeNextActionV2(input: NextActionInput): NextAction {
  const [top] = buildNextActionSignals(input);
  if (!top) return READY_ACTION;
  return { message: top.message, reason: top.reason.message };
}
