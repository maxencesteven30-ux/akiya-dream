import type { DiscoveryResultItem } from "@/lib/discovery/discovery-orchestrator";
import type { ListingAvailabilityStatus } from "@/lib/discovery/property-listing";
import type { HardConstraintVerdict } from "@/lib/discovery/hard-constraint-engine";

// Era 9 (suite) — Phase 3, section 33 de la mission : favoris.
//
// Distinct du pool de candidats (lib/discovery/candidate-listings.ts,
// déjà persistant, déjà l'espace de travail où tout candidat vit) : un
// favori fige un INSTANTANÉ de l'évaluation au moment de la sauvegarde
// (verdict, score de préférences), pour que modifier son profil de
// recherche plus tard n'efface jamais silencieusement "voici ce qui me
// plaisait dans ce bien quand je l'ai vu". Réutilise exactement les
// résultats déjà calculés par evaluateHardConstraints/
// scoreSoftPreferences (via DiscoveryResultItem) — aucun recalcul,
// aucun second moteur de score.
//
// N'invente jamais de champ non demandé par la mission : source,
// identifiant source, URL, date de sauvegarde, statut au moment de la
// sauvegarde, et le score déjà calculé par les moteurs existants.

export interface FavoriteSnapshot {
  listingId: string;
  source: string;
  sourceListingId: string;
  sourceUrl: string | null;
  title: string | null;
  savedAt: string;
  availabilityStatusAtSave: ListingAvailabilityStatus;
  hardConstraintVerdictAtSave: HardConstraintVerdict;
  softPreferenceScoreAtSave: number;
  softPreferenceActiveCriteriaCountAtSave: number;
}

export function createFavoriteSnapshot(item: DiscoveryResultItem, savedAt: string = new Date().toISOString()): FavoriteSnapshot {
  return {
    listingId: item.listing.id,
    source: item.listing.source,
    sourceListingId: item.listing.sourceListingId,
    sourceUrl: item.listing.sourceUrl,
    title: item.listing.title,
    savedAt,
    availabilityStatusAtSave: item.listing.availabilityStatus,
    hardConstraintVerdictAtSave: item.hardConstraintEvaluation.verdict,
    softPreferenceScoreAtSave: item.softPreferenceScore.score,
    softPreferenceActiveCriteriaCountAtSave: item.softPreferenceScore.activeCriteriaCount,
  };
}

export function isFavorite(favorites: FavoriteSnapshot[], listingId: string): boolean {
  return favorites.some((f) => f.listingId === listingId);
}

// Toggle : retire si déjà présent (par listingId), ajoute sinon. Un
// nouvel ajout après retrait re-capture un instantané frais, jamais
// l'ancien.
export function toggleFavorite(favorites: FavoriteSnapshot[], item: DiscoveryResultItem): FavoriteSnapshot[] {
  if (isFavorite(favorites, item.listing.id)) {
    return favorites.filter((f) => f.listingId !== item.listing.id);
  }
  return [...favorites, createFavoriteSnapshot(item)];
}

// Un favori dont le bien a disparu du pool de candidats (retiré ou
// jamais réimporté) reste malgré tout affichable — la mission (section
// 33) demande de conserver la trace même si le bien lui-même n'est plus
// dans l'espace de travail actif ; jamais supprimé silencieusement.
export function removeFavoriteById(favorites: FavoriteSnapshot[], listingId: string): FavoriteSnapshot[] {
  return favorites.filter((f) => f.listingId !== listingId);
}
