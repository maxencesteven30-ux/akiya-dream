import type { BuildingEraCode, RealityGateItemStatus } from "@/lib/types";

// Era 9 / Phase AF — Listing Data Contract.
//
// La forme normalisée qu'une annonce, quelle que soit sa source, doit
// prendre avant d'entrer dans le reste du moteur. Réutilise
// délibérément RealityGateItemStatus (verifie/a_confirmer/probleme) pour
// tous les champs d'accès/réseaux — exactement le même vocabulaire à
// 3 états déjà établi par le Property Reality Gate (Phase V) pour un
// bien que l'utilisateur analyse lui-même : un accès routier ou un
// raccordement inconnus restent "à confirmer", jamais devinés, qu'ils
// proviennent d'une annonce ou d'une saisie manuelle.

export type ListingAvailabilityStatus = "ACTIVE" | "SOLD" | "EXPIRED" | "UNKNOWN";

export const LISTING_AVAILABILITY_LABELS: Record<ListingAvailabilityStatus, string> = {
  ACTIVE: "🟢 Disponible",
  SOLD: "🔴 Vendu",
  EXPIRED: "⚪ Annonce expirée",
  UNKNOWN: "🟠 Statut inconnu",
};

// Distance à la gare la plus proche : le format japonais standard
// ("徒歩15分") exprime une durée à pied, pas une distance — les deux
// unités ne doivent jamais être confondues ou converties silencieusement
// l'une en l'autre.
export interface StationDistance {
  value: number;
  unit: "minutes_walk" | "km";
}

export interface PropertyListing {
  id: string;
  // Identifiant de la source dans le futur SourceRegistry (Phase AG) —
  // une simple chaîne pour l'instant, resserrée quand AG existera.
  source: string;
  sourceListingId: string;
  sourceUrl: string | null;

  title: string | null;
  description: string | null;

  priceJpy: number | null;

  prefecture: string | null;
  municipality: string | null;
  municipalityCode: string | null;

  address: string | null;
  latitude: number | null;
  longitude: number | null;

  landAreaM2: number | null;
  buildingAreaM2: number | null;

  // Nombre de pièces tel que compté par le 間取り japonais (ex. le "3"
  // dans "3LDK") — jamais assimilé directement à un nombre de chambres
  // occidental sans le dire explicitement (cf. parseFloorPlan).
  roomCount: number | null;
  floorPlanRaw: string | null;

  buildingYear: number | null;
  buildingEra: BuildingEraCode | null;

  // Catégorie brute de la source (ex. "宅地", "山林", "畑") — jamais
  // réinterprétée en une classification qu'elle n'affirme pas.
  propertyType: string | null;

  hasGarden: boolean | null;
  hasParking: boolean | null;

  nearestStation: string | null;
  stationDistance: StationDistance | null;

  roadAccess: RealityGateItemStatus | null;
  rebuildability: RealityGateItemStatus | null;

  water: RealityGateItemStatus | null;
  electricity: RealityGateItemStatus | null;
  gas: RealityGateItemStatus | null;
  sewage: RealityGateItemStatus | null;
  septicTank: RealityGateItemStatus | null;

  availabilityStatus: ListingAvailabilityStatus;

  listingPublishedAt: string | null;
  listingUpdatedAt: string | null;
  retrievedAt: string;

  // Charge utile brute de la source, conservée telle quelle pour audit —
  // jamais reparsée implicitement ailleurs dans le moteur.
  rawData: unknown;
}

// Un listing "vide" : tout ce qui n'est pas explicitement connu reste
// null — jamais une valeur favorable ou neutre par défaut.
export function createEmptyPropertyListing(
  id: string,
  source: string,
  sourceListingId: string,
  retrievedAt: string = new Date().toISOString(),
): PropertyListing {
  return {
    id,
    source,
    sourceListingId,
    sourceUrl: null,
    title: null,
    description: null,
    priceJpy: null,
    prefecture: null,
    municipality: null,
    municipalityCode: null,
    address: null,
    latitude: null,
    longitude: null,
    landAreaM2: null,
    buildingAreaM2: null,
    roomCount: null,
    floorPlanRaw: null,
    buildingYear: null,
    buildingEra: null,
    propertyType: null,
    hasGarden: null,
    hasParking: null,
    nearestStation: null,
    stationDistance: null,
    roadAccess: null,
    rebuildability: null,
    water: null,
    electricity: null,
    gas: null,
    sewage: null,
    septicTank: null,
    availabilityStatus: "UNKNOWN",
    listingPublishedAt: null,
    listingUpdatedAt: null,
    retrievedAt,
    rawData: null,
  };
}
