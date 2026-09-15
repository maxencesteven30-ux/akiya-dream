import type { PropertyListing } from "@/lib/discovery/property-listing";
import type { Region } from "@/lib/types";
import { basePrefectureLabel, findPrefectureByFreeText } from "@/lib/japan-prefectures";

// Era 9 (suite) — Phase 4, section 30-31 de la mission : relier les
// biens découverts à la carte existante (components/simulateur/japan-map.tsx).
//
// La carte du Japon de ce projet est une carte CHOROPLÈTHE par
// préfecture (18 régions curatées coloriées par valeur), pas une carte à
// points géolocalisés — un bien saisi manuellement n'a presque jamais de
// coordonnées GPS exactes (cf. lib/discovery/manual-intake.ts, aucun
// champ latitude/longitude dans le formulaire). Afficher un pin précis
// par bien inventerait donc une position. Ce module calcule à la place
// un COMPTE d'annonces par région curatée — une agrégation honnête,
// jamais une localisation exacte affirmée.
//
// Un listing dont le champ libre `prefecture` ne correspond à AUCUNE
// préfecture réelle connue (findPrefectureByFreeText) n'est compté nulle
// part plutôt que rattaché par approximation. Une région composite
// (ex. "Fukuoka_Periph") récupère les biens de toute la préfecture
// "Fukuoka" — même convention indicative déjà documentée et acceptée
// dans japan-map.tsx pour les valeurs régionales existantes (prix
// médian, ancienneté...), pas une nouvelle approximation introduite ici.

export function countListingsByRegion(listings: PropertyListing[], regions: Region[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const listing of listings) {
    const jpPrefecture = findPrefectureByFreeText(listing.prefecture);
    if (!jpPrefecture) continue;

    const matchingRegion = regions.find((r) => basePrefectureLabel(r.prefecture) === jpPrefecture.label);
    if (!matchingRegion) continue;

    counts.set(matchingRegion.prefecture, (counts.get(matchingRegion.prefecture) ?? 0) + 1);
  }

  return counts;
}
