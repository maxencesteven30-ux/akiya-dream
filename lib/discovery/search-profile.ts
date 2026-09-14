import { computeMaxAffordablePrice } from "@/lib/opportunity";
import { computeRenovationBudget } from "@/lib/calculations";
import type { SimulatorState } from "@/lib/types";

// Era 9 / Phase AE — Search Profile.
//
// "Voici mon projet -> trouve-moi les akiya qui correspondent." Le profil
// distingue trois catégories, jamais mélangées (section 9 de la mission) :
// - HARD CONSTRAINT : critère éliminatoire (budget max, surface min...) ;
// - SOFT PREFERENCE : influence le classement, n'élimine jamais ;
// - un critère non renseigné reste UNKNOWN, jamais silencieusement traité
//   comme "sans importance" ou comme une valeur par défaut favorable.
//
// N'introduit aucun nouveau moteur de calcul : maxBudgetJpy réutilise
// exactement computeMaxAffordablePrice (lib/opportunity.ts), déjà utilisé
// ailleurs dans Akiya Dream pour la même question.

export interface HardConstraints {
  maxBudgetJpy: number | null;
  minBuildingAreaM2: number | null;
  minBedrooms: number | null;
  // Liste vide = aucune exclusion (une donnée valide en soi, jamais
  // confondue avec "non renseigné").
  excludedPrefectures: string[];
  // null = l'utilisateur n'a pas encore décidé si ce critère doit être
  // éliminatoire — jamais présumé "oui" ni "non" par défaut.
  requiresKnownRebuildability: boolean | null;
}

export interface SoftPreferences {
  preferredPrefectures: string[];
  wantsGarden: boolean | null;
  maxStationDistanceMinutes: number | null;
  ruralEnvironment: boolean | null;
  noCarRequired: boolean | null;
  renovationAcceptable: boolean | null;
}

export interface SearchProfile {
  hardConstraints: HardConstraints;
  softPreferences: SoftPreferences;
  // Libellés humains des critères importants pour la recherche mais non
  // encore documentés — recalculé, jamais maintenu à la main en double.
  unknownCriteria: string[];
}

const CRITERION_LABELS = {
  maxBudgetJpy: "Budget maximum",
  minBuildingAreaM2: "Surface habitable minimale",
  minBedrooms: "Nombre de chambres minimal",
  requiresKnownRebuildability: "Exigence d'un droit de reconstruire déjà vérifié",
  wantsGarden: "Présence d'un jardin souhaitée",
  maxStationDistanceMinutes: "Distance maximale à la gare",
  ruralEnvironment: "Environnement rural souhaité",
  noCarRequired: "Absence de voiture souhaitée",
  renovationAcceptable: "Tolérance à la rénovation",
} as const;

function computeUnknownCriteria(hardConstraints: HardConstraints, softPreferences: SoftPreferences): string[] {
  const unknown: string[] = [];
  if (hardConstraints.maxBudgetJpy === null) unknown.push(CRITERION_LABELS.maxBudgetJpy);
  if (hardConstraints.minBuildingAreaM2 === null) unknown.push(CRITERION_LABELS.minBuildingAreaM2);
  if (hardConstraints.minBedrooms === null) unknown.push(CRITERION_LABELS.minBedrooms);
  if (hardConstraints.requiresKnownRebuildability === null) {
    unknown.push(CRITERION_LABELS.requiresKnownRebuildability);
  }
  if (softPreferences.wantsGarden === null) unknown.push(CRITERION_LABELS.wantsGarden);
  if (softPreferences.maxStationDistanceMinutes === null) unknown.push(CRITERION_LABELS.maxStationDistanceMinutes);
  if (softPreferences.ruralEnvironment === null) unknown.push(CRITERION_LABELS.ruralEnvironment);
  if (softPreferences.noCarRequired === null) unknown.push(CRITERION_LABELS.noCarRequired);
  if (softPreferences.renovationAcceptable === null) unknown.push(CRITERION_LABELS.renovationAcceptable);
  return unknown;
}

function buildSearchProfile(
  hardConstraints: HardConstraints,
  softPreferences: SoftPreferences,
): SearchProfile {
  return {
    hardConstraints,
    softPreferences,
    unknownCriteria: computeUnknownCriteria(hardConstraints, softPreferences),
  };
}

export function createEmptySearchProfile(): SearchProfile {
  return buildSearchProfile(
    {
      maxBudgetJpy: null,
      minBuildingAreaM2: null,
      minBedrooms: null,
      excludedPrefectures: [],
      requiresKnownRebuildability: null,
    },
    {
      preferredPrefectures: [],
      wantsGarden: null,
      maxStationDistanceMinutes: null,
      ruralEnvironment: null,
      noCarRequired: null,
      renovationAcceptable: null,
    },
  );
}

// Ne redemande jamais une information déjà connue du projet en cours
// (section 9) — mais seulement pour les champs dont la correspondance est
// directe et sans ambiguïté. Ne devine PAS de préférences (jardin,
// environnement rural, tolérance travaux...) à partir de champs qui ne
// les impliquent pas réellement : mieux vaut un critère UNKNOWN honnête
// qu'une préférence inventée.
export function deriveSearchProfileFromProject(state: SimulatorState): SearchProfile {
  const empty = createEmptySearchProfile();

  let maxBudgetJpy: number | null = null;
  if (state.profile !== null && state.capitalDisponibleEur !== null && state.reserveSecuriteEur !== null) {
    const travauxJpy = state.renovationLevel ? computeRenovationBudget(state.renovationLevel) : 0;
    maxBudgetJpy = computeMaxAffordablePrice(
      state.profile,
      travauxJpy,
      state.capitalDisponibleEur,
      state.reserveSecuriteEur,
    );
  }

  const preferredPrefectures = state.prefecture ? [state.prefecture] : [];

  return buildSearchProfile(
    { ...empty.hardConstraints, maxBudgetJpy },
    { ...empty.softPreferences, preferredPrefectures },
  );
}
