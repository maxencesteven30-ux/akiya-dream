import type { VisitChecklistState, VisitStage } from "@/lib/types";

// Phase Q — Préparation du voyage de visite.
//
// Une checklist en 3 temps (avant / pendant / après), pensée pour
// fonctionner hors ligne une fois l'application déjà ouverte une première
// fois en ligne (cf. public/sw.js) : aucune de ces cases ne dépend d'un
// appel réseau, uniquement de l'état local persisté (comme lib/history.ts).

export interface VisitChecklistItemDef {
  id: string;
  stage: VisitStage;
  label: string;
}

export const STAGE_LABELS: Record<VisitStage, string> = {
  avant: "🧳 Avant la visite",
  pendant: "🔍 Pendant la visite",
  apres: "📋 Après la visite",
};

// Liste de référence, volontairement courte et actionnable (pas une
// duplication de la checklist due diligence, qui vérifie l'état du bien —
// ici il s'agit de préparer et dérouler le déplacement lui-même).
export const VISIT_CHECKLIST_TEMPLATE: VisitChecklistItemDef[] = [
  { id: "avant_rdv_confirme", stage: "avant", label: "Rendez-vous confirmé avec l'agence ou le vendeur" },
  {
    id: "avant_documents",
    stage: "avant",
    label: "Annonce, plan cadastral et photos téléchargés pour un accès hors ligne",
  },
  { id: "avant_questions", stage: "avant", label: "Liste de questions préparée pour l'agence" },
  { id: "avant_itineraire", stage: "avant", label: "Itinéraire et moyen de transport vérifiés" },
  {
    id: "avant_especes",
    stage: "avant",
    label: "Espèces prévues (zones rurales, cartes parfois non acceptées)",
  },
  { id: "pendant_photos", stage: "pendant", label: "Photos de chaque pièce et des extérieurs prises" },
  { id: "pendant_toiture", stage: "pendant", label: "État du toit observé depuis l'extérieur" },
  { id: "pendant_reseaux", stage: "pendant", label: "Interrupteurs, robinets et évacuations testés" },
  { id: "pendant_humidite", stage: "pendant", label: "Odeurs et traces d'humidité vérifiées" },
  {
    id: "pendant_distances",
    stage: "pendant",
    label: "Distance réelle à pied jusqu'à la gare/aux commerces mesurée",
  },
  { id: "pendant_questions", stage: "pendant", label: "Questions préparées posées à l'agence" },
  {
    id: "apres_dossier",
    stage: "apres",
    label: "Checklist due diligence mise à jour avec les constats de la visite",
  },
  {
    id: "apres_historique",
    stage: "apres",
    label: "Point d'étape « après visite » enregistré (historique du projet)",
  },
  { id: "apres_decision", stage: "apres", label: "Décision prise : négocier, poursuivre ou abandonner" },
];

export function createEmptyVisitChecklist(): VisitChecklistState {
  return Object.fromEntries(VISIT_CHECKLIST_TEMPLATE.map((item) => [item.id, false]));
}

export function getItemsByStage(stage: VisitStage): VisitChecklistItemDef[] {
  return VISIT_CHECKLIST_TEMPLATE.filter((item) => item.stage === stage);
}

export interface VisitStageProgress {
  stage: VisitStage;
  completed: number;
  total: number;
  percent: number;
}

const STAGES: VisitStage[] = ["avant", "pendant", "apres"];

export function computeVisitProgress(state: VisitChecklistState): VisitStageProgress[] {
  return STAGES.map((stage) => {
    const items = getItemsByStage(stage);
    const completed = items.filter((item) => state[item.id] === true).length;
    return {
      stage,
      completed,
      total: items.length,
      percent: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
    };
  });
}
