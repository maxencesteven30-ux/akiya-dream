import type { ChecklistCategory, ChecklistStatus, DueDiligenceState } from "@/lib/types";

export interface ChecklistItemDef {
  id: string;
  category: ChecklistCategory;
  label: string;
}

// Liste de référence reprise telle quelle de la spécification (29 éléments
// répartis en 4 catégories) — aucun élément ajouté ou retiré.
export const CHECKLIST_TEMPLATE: ChecklistItemDef[] = [
  // 🏠 Bâtiment
  { id: "batiment_annee", category: "batiment", label: "Année de construction" },
  { id: "batiment_structure", category: "batiment", label: "Structure" },
  { id: "batiment_toiture", category: "batiment", label: "Toiture" },
  { id: "batiment_fondations", category: "batiment", label: "Fondations" },
  { id: "batiment_humidite", category: "batiment", label: "Humidité" },
  { id: "batiment_termites", category: "batiment", label: "Termites" },
  { id: "batiment_isolation", category: "batiment", label: "Isolation" },
  { id: "batiment_electricite", category: "batiment", label: "Électricité" },
  { id: "batiment_plomberie", category: "batiment", label: "Plomberie" },
  { id: "batiment_hvac", category: "batiment", label: "HVAC (climatisation/chauffage)" },
  // 📜 Juridique
  { id: "juridique_proprietaire", category: "juridique", label: "Propriétaire" },
  { id: "juridique_cadastre", category: "juridique", label: "Situation cadastrale" },
  { id: "juridique_servitudes", category: "juridique", label: "Servitudes" },
  { id: "juridique_acces", category: "juridique", label: "Droits d'accès" },
  { id: "juridique_arrieres", category: "juridique", label: "Arriérés" },
  { id: "juridique_statut_terrain", category: "juridique", label: "Statut du terrain" },
  { id: "juridique_restrictions", category: "juridique", label: "Éventuelles restrictions" },
  // 🌍 Terrain
  { id: "terrain_risques_naturels", category: "terrain", label: "Risques naturels" },
  { id: "terrain_acces", category: "terrain", label: "Accès" },
  { id: "terrain_pente", category: "terrain", label: "Pente" },
  { id: "terrain_limites", category: "terrain", label: "Limites" },
  { id: "terrain_bornage", category: "terrain", label: "Bornage" },
  { id: "terrain_assainissement", category: "terrain", label: "Assainissement" },
  // 🏘️ Vie locale
  { id: "vie_locale_gare", category: "vie_locale", label: "Gare" },
  { id: "vie_locale_commerces", category: "vie_locale", label: "Commerces" },
  { id: "vie_locale_hopital", category: "vie_locale", label: "Hôpital" },
  { id: "vie_locale_dechets", category: "vie_locale", label: "Collecte des déchets" },
  { id: "vie_locale_chonaikai", category: "vie_locale", label: "Chōnaikai (association de quartier)" },
  { id: "vie_locale_deneigement", category: "vie_locale", label: "Déneigement" },
];

export const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  batiment: "🏠 Bâtiment",
  juridique: "📜 Juridique",
  terrain: "🌍 Terrain",
  vie_locale: "🏘️ Vie locale",
};

export const STATUS_LABELS: Record<ChecklistStatus, string> = {
  a_verifier: "À vérifier",
  verifie: "Vérifié",
  probleme: "Problème détecté",
  non_applicable: "Non applicable",
};

export function createEmptyChecklist(): DueDiligenceState {
  return Object.fromEntries(CHECKLIST_TEMPLATE.map((item) => [item.id, "a_verifier"]));
}

export function getItemsByCategory(category: ChecklistCategory): ChecklistItemDef[] {
  return CHECKLIST_TEMPLATE.filter((item) => item.category === category);
}

export interface CompletionSummary {
  completed: number;
  total: number;
  percent: number;
  hasProblem: boolean;
}

// "Complété" = tout statut différent de "à vérifier" : un élément marqué
// "vérifié", "problème détecté" ou "non applicable" a été traité, même si
// la réponse n'est pas favorable. Un élément absent du state (jamais
// consulté) compte comme "à vérifier", jamais comme un statut positif.
export function computeCompletionSummary(state: DueDiligenceState): CompletionSummary {
  const total = CHECKLIST_TEMPLATE.length;
  let completed = 0;
  let hasProblem = false;

  for (const item of CHECKLIST_TEMPLATE) {
    const status = state[item.id] ?? "a_verifier";
    if (status !== "a_verifier") completed += 1;
    if (status === "probleme") hasProblem = true;
  }

  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    hasProblem,
  };
}

export type DueDiligenceVerdict = "documente" | "incomplet" | "deconseille";

export const DUE_DILIGENCE_VERDICT_LABELS: Record<DueDiligenceVerdict, string> = {
  documente: "🟢 Dossier suffisamment documenté",
  incomplet: "🟠 Plusieurs éléments critiques restent inconnus",
  deconseille: "🔴 Offre déconseillée tant que certains points ne sont pas vérifiés",
};

// Seuil déterministe (règle de gestion explicite, pas une donnée mesurée) :
// un seul "problème détecté" suffit à déconseiller l'offre, indépendamment
// du taux de complétude — un problème avéré (ex. termites confirmées) ne
// doit jamais être masqué par un dossier par ailleurs bien rempli.
const DOCUMENTED_THRESHOLD_PERCENT = 70;

export function computeDueDiligenceVerdict(summary: CompletionSummary): DueDiligenceVerdict {
  if (summary.hasProblem) return "deconseille";
  if (summary.percent >= DOCUMENTED_THRESHOLD_PERCENT) return "documente";
  return "incomplet";
}
