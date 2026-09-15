import type { PropertyListing } from "@/lib/discovery/property-listing";
import type { BuyerProfile, Region, RealListing, RenovationLevel } from "@/lib/types";
import type { OpportunityInput } from "@/lib/opportunity";

// Era 9 (suite) — pont Discovery -> Opportunity Engine.
//
// N'introduit AUCUN nouveau moteur de score : construit uniquement la
// forme d'entrée (OpportunityInput) que lib/opportunity.ts attend déjà,
// à partir des champs réels d'un PropertyListing découvert. La logique
// de scoring elle-même (computeOpportunityScore) n'est ni recalculée ni
// modifiée ici.
//
// Deux champs de RealListing n'ont pas d'équivalent direct et fiable
// sur PropertyListing — jamais devinés :
// - `condition` : PropertyListing ne porte aucun champ "état du bien"
//   structuré (seulement des statuts Reality Gate ponctuels comme
//   roadAccess/rebuildability, qui ne décrivent pas l'état général du
//   bâti). Toujours "unknown" pour un listing découvert.
// - `stationDistanceKm` : PropertyListing.stationDistance peut être en
//   minutes de marche (format japonais standard, 徒歩15分) — jamais
//   converti en km sans une vitesse de marche non documentée. Rempli
//   uniquement quand l'unité déjà présente est "km".

export interface OpportunityBridgeContext {
  profile: BuyerProfile;
  renovationLevel: RenovationLevel;
  region: Region | null;
  capitalDisponibleEur?: number | null;
  reserveSecuriteEur?: number | null;
}

function toRealListing(listing: PropertyListing): RealListing {
  return {
    name: listing.title ?? "",
    city: listing.municipality ?? "",
    latitude: listing.latitude,
    longitude: listing.longitude,
    municipalityCode: listing.municipalityCode,
    surfaceM2: listing.buildingAreaM2,
    landM2: listing.landAreaM2,
    constructionYear: listing.buildingYear,
    stationDistanceKm: listing.stationDistance?.unit === "km" ? listing.stationDistance.value : null,
    condition: "unknown",
  };
}

// Retourne null si le listing n'a pas de prix exploitable — rien à
// évaluer, jamais un prix substitué ou estimé.
export function buildOpportunityInput(
  listing: PropertyListing,
  context: OpportunityBridgeContext,
): OpportunityInput | null {
  if (listing.priceJpy === null) return null;

  return {
    prixAchatJpy: listing.priceJpy,
    profile: context.profile,
    renovationLevel: context.renovationLevel,
    region: context.region,
    listing: toRealListing(listing),
    capitalDisponibleEur: context.capitalDisponibleEur,
    reserveSecuriteEur: context.reserveSecuriteEur,
  };
}
