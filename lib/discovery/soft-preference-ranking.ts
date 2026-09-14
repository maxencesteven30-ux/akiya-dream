import type { PropertyListing } from "@/lib/discovery/property-listing";
import type { SoftPreferences } from "@/lib/discovery/search-profile";

// Era 9 / Phase AK — Soft Preference Ranking.
//
// AJ élimine (PASS/FAIL/UNKNOWN, trois états stricts). AK classe ce qui
// reste — une préférence douce n'élimine jamais rien, elle influence
// seulement l'ordre (section 9 de la mission). Un score ne baisse
// jamais parce qu'une donnée est inconnue : une inconnue reste neutre,
// jamais traitée comme un point négatif ni comme une correspondance
// gratuite.
//
// Sur les 6 préférences de SoftPreferences (AE), seules 3 ont un champ
// PropertyListing réellement comparable aujourd'hui (préfecture, jardin,
// distance à la gare en minutes à pied). Les 3 autres (ruralEnvironment,
// noCarRequired, renovationAcceptable) n'ont aucun fait correspondant
// sur PropertyListing — les déduire d'autres champs (ex. l'âge du
// bâtiment pour renovationAcceptable) serait une estimation déguisée en
// fait. Elles restent donc "unknown" dès qu'activées : une limite
// honnête du modèle de données actuel, pas un oubli.

export type MatchStatus = "matched" | "unmatched" | "unknown" | "not_active";

export interface PreferenceMatchResult {
  criterionId: string;
  label: string;
  status: MatchStatus;
}

export interface SoftPreferenceScore {
  listing: PropertyListing;
  score: number;
  activeCriteriaCount: number;
  matches: PreferenceMatchResult[];
}

function checkPreferredPrefecture(
  preferredPrefectures: string[],
  prefecture: string | null,
): MatchStatus {
  if (preferredPrefectures.length === 0) return "not_active";
  if (prefecture === null) return "unknown";
  return preferredPrefectures.includes(prefecture) ? "matched" : "unmatched";
}

function checkWantsGarden(wantsGarden: boolean | null, hasGarden: boolean | null): MatchStatus {
  if (wantsGarden === null) return "not_active";
  if (hasGarden === null) return "unknown";
  return hasGarden === wantsGarden ? "matched" : "unmatched";
}

function checkMaxStationDistance(
  maxStationDistanceMinutes: number | null,
  stationDistance: PropertyListing["stationDistance"],
): MatchStatus {
  if (maxStationDistanceMinutes === null) return "not_active";
  if (stationDistance === null) return "unknown";
  // Une distance exprimée en km n'est jamais convertie en minutes à
  // pied ici (la convention ~80m/min est indicative, pas une mesure,
  // cf. lib/discovery/japanese-terms.ts) — non comparable, reste
  // honnêtement "unknown" plutôt qu'une conversion approximative.
  if (stationDistance.unit !== "minutes_walk") return "unknown";
  return stationDistance.value <= maxStationDistanceMinutes ? "matched" : "unmatched";
}

// Aucun champ PropertyListing correspondant aujourd'hui — voir le
// commentaire d'en-tête. Reste "unknown" dès que le critère est activé.
function checkNoComparableField(preferenceValue: boolean | null): MatchStatus {
  if (preferenceValue === null) return "not_active";
  return "unknown";
}

const CRITERIA: {
  id: string;
  label: string;
  check: (preferences: SoftPreferences, listing: PropertyListing) => MatchStatus;
}[] = [
  {
    id: "preferredPrefectures",
    label: "Préfecture préférée",
    check: (p, l) => checkPreferredPrefecture(p.preferredPrefectures, l.prefecture),
  },
  {
    id: "wantsGarden",
    label: "Jardin souhaité",
    check: (p, l) => checkWantsGarden(p.wantsGarden, l.hasGarden),
  },
  {
    id: "maxStationDistanceMinutes",
    label: "Distance maximale à la gare",
    check: (p, l) => checkMaxStationDistance(p.maxStationDistanceMinutes, l.stationDistance),
  },
  {
    id: "ruralEnvironment",
    label: "Environnement rural souhaité",
    check: (p) => checkNoComparableField(p.ruralEnvironment),
  },
  {
    id: "noCarRequired",
    label: "Absence de voiture souhaitée",
    check: (p) => checkNoComparableField(p.noCarRequired),
  },
  {
    id: "renovationAcceptable",
    label: "Tolérance à la rénovation",
    check: (p) => checkNoComparableField(p.renovationAcceptable),
  },
];

export function scoreSoftPreferences(
  preferences: SoftPreferences,
  listing: PropertyListing,
): SoftPreferenceScore {
  const matches = CRITERIA.map(({ id, label, check }) => ({
    criterionId: id,
    label,
    status: check(preferences, listing),
  }));

  return {
    listing,
    score: matches.filter((m) => m.status === "matched").length,
    activeCriteriaCount: matches.filter((m) => m.status !== "not_active").length,
    matches,
  };
}

// Trie par score décroissant sans jamais éliminer personne — une
// préférence non correspondante ou inconnue laisse simplement le bien
// plus bas dans le classement, il reste dans la liste (contrairement à
// evaluateHardConstraints en Phase AJ, qui élimine).
export function rankListingsBySoftPreferences(
  preferences: SoftPreferences,
  listings: PropertyListing[],
): SoftPreferenceScore[] {
  return listings
    .map((listing) => scoreSoftPreferences(preferences, listing))
    .sort((a, b) => b.score - a.score);
}
