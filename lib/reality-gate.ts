import type {
  LandNature,
  RealityGateDocumentsState,
  RealityGateItemStatus,
  RealityGateState,
} from "@/lib/types";

// Phase V — Property Reality Gate.
//
// "Ce bien est-il réellement achetable et exploitable ?" — une question
// juridique/technique qui prime sur la note d'opportunité (cf. Phase U) :
// un très bon score ne doit jamais masquer un blocage avéré.
//
// Chaque élément est une checklist déclarative (l'utilisateur constate ce
// qu'il sait ou ce qu'on lui a dit) — jamais une conclusion automatique.
// Akiya Dream ne calcule jamais "constructible" ou "non constructible" à
// partir de deux champs ; il ne fait que refléter ce qui est déjà su ou
// inconnu, et rappelle de vérifier auprès de la mairie/du notaire.
//
// Repères réglementaires généraux cités dans les libellés (à vérifier au
// cas par cas, jamais appliqués automatiquement par le code) :
// - Building Standards Act, art. 42-43 : un terrain doit en principe
//   donner sur une voie réglementaire d'au moins 4 m de large sur au
//   moins 2 m de façade, sauf exceptions (art. 43).
// - Loi sur les forêts : notification à la mairie dans les 90 jours après
//   acquisition d'un terrain forestier (formulaire incluant la
//   nationalité depuis avril 2026).
// - Loi sur les terres agricoles (art. 3) : l'autorisation de la
//   commission agricole (nōgyō iinkai) repose sur l'usage agricole
//   effectif prévu, pas sur la nationalité — mais l'exercice réel d'une
//   activité agricole est difficile à démontrer pour un résident à
//   l'étranger.
// - Loi sur les fosses septiques (johkasou) : contrôle légal annuel de la
//   qualité de l'eau par un organisme agréé.

export interface RealityGateItemDef {
  id: string;
  category: "acces" | "reconstruction" | "reseaux";
  label: string;
}

export const REALITY_GATE_STATUS_LABELS: Record<RealityGateItemStatus, string> = {
  verifie: "🟢 Vérifié",
  a_confirmer: "🟠 À confirmer par la mairie",
  probleme: "🔴 Problème identifié",
};

export const CATEGORY_LABELS: Record<RealityGateItemDef["category"], string> = {
  acces: "🛣️ Accès au terrain",
  reconstruction: "🏗️ Droit à reconstruire",
  reseaux: "🔌 Réseaux",
};

export const RECONSTRUCTION_ITEM_ID = "reconstruction_droit";

export const REALITY_GATE_TEMPLATE: RealityGateItemDef[] = [
  // V.1 — Accès au terrain
  { id: "acces_route_publique", category: "acces", label: "Route publique" },
  { id: "acces_route_privee", category: "acces", label: "Route privée" },
  { id: "acces_largeur_connue", category: "acces", label: "Largeur de la voie connue" },
  { id: "acces_droit_passage", category: "acces", label: "Droit de passage" },
  { id: "acces_servitude", category: "acces", label: "Servitude" },
  { id: "acces_vehicule", category: "acces", label: "Accès véhicule" },
  { id: "acces_pompiers", category: "acces", label: "Accès pompiers connu" },
  {
    id: "acces_conformite_voirie",
    category: "acces",
    label: "Conformité au régime de voirie (largeur/façade)",
  },
  // V.2 — Droit à reconstruire
  { id: RECONSTRUCTION_ITEM_ID, category: "reconstruction", label: "Droit à reconstruire confirmé" },
  // V.4 — Réseaux
  { id: "reseau_eau", category: "reseaux", label: "Eau" },
  { id: "reseau_egout", category: "reseaux", label: "Égout" },
  { id: "reseau_fosse", category: "reseaux", label: "Fosse septique" },
  { id: "reseau_electricite", category: "reseaux", label: "Électricité" },
  { id: "reseau_gaz", category: "reseaux", label: "Gaz" },
  { id: "reseau_internet", category: "reseaux", label: "Internet" },
];

export function createEmptyRealityGate(): RealityGateState {
  return Object.fromEntries(REALITY_GATE_TEMPLATE.map((item) => [item.id, "a_confirmer" as const]));
}

export function getItemsByCategory(category: RealityGateItemDef["category"]): RealityGateItemDef[] {
  return REALITY_GATE_TEMPLATE.filter((item) => item.category === category);
}

// V.3 — Nature juridique du terrain.
export const LAND_NATURE_LABELS: Record<LandNature, string> = {
  residentiel: "🟢 Terrain résidentiel",
  forestier: "🟠 Terrain forestier à vérifier",
  agricole: "🔴 Terrain agricole soumis à restrictions",
};

// null (non renseigné) traité comme "à confirmer" : jamais résidentiel par
// défaut.
export function computeLandNatureSeverity(nature: LandNature | null): RealityGateItemStatus {
  if (nature === "agricole") return "probleme";
  if (nature === "residentiel") return "verifie";
  return "a_confirmer";
}

// V.5 — Documents officiels disponibles.
export interface RealityGateDocumentDef {
  id: string;
  label: string;
}

export const REALITY_GATE_DOCUMENTS_TEMPLATE: RealityGateDocumentDef[] = [
  { id: "doc_registre", label: "Registre immobilier (tōki)" },
  { id: "doc_plan_cadastral", label: "Plan cadastral" },
  { id: "doc_plan_mesurage", label: "Plan de mesurage" },
  { id: "doc_plan_batiment", label: "Plan du bâtiment" },
  { id: "doc_voirie", label: "Documents de voirie" },
  { id: "doc_urbanisme", label: "Documents d'urbanisme" },
  { id: "doc_taxe_fonciere", label: "Facture de taxe foncière" },
  { id: "doc_fosse", label: "Documents de fosse septique" },
  { id: "doc_diagnostics", label: "Diagnostics" },
  { id: "doc_devis", label: "Devis" },
];

export function createEmptyRealityGateDocuments(): RealityGateDocumentsState {
  return Object.fromEntries(REALITY_GATE_DOCUMENTS_TEMPLATE.map((doc) => [doc.id, false]));
}

export interface DocumentsAvailabilitySummary {
  available: number;
  total: number;
}

export function computeDocumentsAvailability(
  state: RealityGateDocumentsState,
): DocumentsAvailabilitySummary {
  const total = REALITY_GATE_DOCUMENTS_TEMPLATE.length;
  const available = REALITY_GATE_DOCUMENTS_TEMPLATE.filter((doc) => state[doc.id] === true).length;
  return { available, total };
}

// Résultat V — Property Reality Gate.
export type RealityGateLevel = "vert" | "orange" | "rouge";

export interface RealityGateResult {
  level: RealityGateLevel;
  blockingCount: number;
  toConfirmCount: number;
}

// Un seul "problème identifié" (item ou terrain agricole) suffit à passer
// au rouge, indépendamment du reste — même logique que le due diligence
// (Phase L) : un blocage avéré ne se dilue jamais dans une moyenne.
export function computeRealityGate(
  state: RealityGateState,
  landNature: LandNature | null,
): RealityGateResult {
  const itemStatuses = REALITY_GATE_TEMPLATE.map((item) => state[item.id] ?? "a_confirmer");
  const allStatuses = [...itemStatuses, computeLandNatureSeverity(landNature)];

  const blockingCount = allStatuses.filter((s) => s === "probleme").length;
  const toConfirmCount = allStatuses.filter((s) => s === "a_confirmer").length;

  const level: RealityGateLevel = blockingCount > 0 ? "rouge" : toConfirmCount > 0 ? "orange" : "vert";
  return { level, blockingCount, toConfirmCount };
}

export function getRealityGateMessage(result: RealityGateResult): string {
  if (result.level === "rouge") {
    return `🔴 ${result.blockingCount} blocage${result.blockingCount > 1 ? "s" : ""} potentiel${result.blockingCount > 1 ? "s" : ""}`;
  }
  if (result.level === "orange") {
    return `🟠 ${result.toConfirmCount} élément${result.toConfirmCount > 1 ? "s" : ""} critique${result.toConfirmCount > 1 ? "s" : ""} à confirmer`;
  }
  return "🟢 Aucun blocage identifié";
}

// Action concrète suggérée pour chaque élément marqué "problème identifié"
// — une règle de gestion explicite et bornée, jamais une recommandation
// générée à la volée.
export const REALITY_GATE_PROBLEM_ACTIONS: Record<string, string> = {
  acces_route_publique: "Faire confirmer le statut de la voie d'accès (publique/privée) auprès de la mairie.",
  acces_route_privee: "Faire confirmer le statut de la voie d'accès (publique/privée) auprès de la mairie.",
  acces_largeur_connue: "Faire mesurer la largeur réelle de la voie d'accès.",
  acces_droit_passage: "Faire confirmer par écrit l'existence d'un droit de passage.",
  acces_servitude: "Faire lister les servitudes grevant l'accès par un professionnel.",
  acces_vehicule: "Vérifier que la voie permet effectivement le passage d'un véhicule.",
  acces_pompiers: "Faire confirmer l'accès pompiers auprès de la mairie.",
  acces_conformite_voirie:
    "Faire confirmer la conformité au régime de voirie (largeur/façade) auprès de la mairie avant toute offre.",
  [RECONSTRUCTION_ITEM_ID]:
    "Contacter la municipalité et demander une confirmation écrite du droit à reconstruire.",
  reseau_eau: "Faire vérifier le raccordement en eau.",
  reseau_egout: "Faire vérifier le raccordement à l'égout.",
  reseau_fosse: "Faire vérifier l'état et la conformité de la fosse septique.",
  reseau_electricite: "Faire vérifier le raccordement électrique.",
  reseau_gaz: "Faire vérifier le raccordement au gaz.",
  reseau_internet: "Faire vérifier la disponibilité d'une connexion internet.",
};

export const LAND_NATURE_PROBLEM_ACTION =
  "Faire confirmer le statut agricole du terrain auprès de la commission agricole (nōgyō iinkai) avant toute offre.";
