import type { PropertyListing } from "@/lib/discovery/property-listing";

// Era 9 / Phase AI — Candidate Listing Pool.
//
// AH produit un PropertyListing à la fois, à partir d'une saisie
// assistée. AJ (moteur de contraintes dures) a besoin d'une liste de
// candidats sur laquelle filtrer — ce module gère cette liste, sans
// introduire de nouvelle logique de score ou de filtrage (ça reste le
// rôle d'AJ).
//
// Une seule règle métier ici : deux saisies pour la même annonce
// (même source + même sourceListingId) ne doivent jamais coexister en
// double dans le pool — la plus récente (une ressaisie après mise à
// jour de l'annonce, par ex.) remplace l'ancienne au même index, elle
// ne s'ajoute pas à côté.

export function findCandidateListing(
  listings: PropertyListing[],
  source: string,
  sourceListingId: string,
): PropertyListing | null {
  return listings.find((l) => l.source === source && l.sourceListingId === sourceListingId) ?? null;
}

export function upsertCandidateListing(
  listings: PropertyListing[],
  listing: PropertyListing,
): PropertyListing[] {
  const existingIndex = listings.findIndex(
    (l) => l.source === listing.source && l.sourceListingId === listing.sourceListingId,
  );

  if (existingIndex === -1) {
    return [...listings, listing];
  }

  const next = [...listings];
  next[existingIndex] = listing;
  return next;
}

export function removeCandidateListing(listings: PropertyListing[], id: string): PropertyListing[] {
  return listings.filter((l) => l.id !== id);
}
