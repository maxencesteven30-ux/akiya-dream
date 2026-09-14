import { getBuildingEraCode } from "@/lib/building-eras";
import {
  createEmptyPropertyListing,
  type ListingAvailabilityStatus,
  type PropertyListing,
} from "@/lib/discovery/property-listing";
import {
  parseAreaM2,
  parseBuildingYearTerm,
  parseFloorPlan,
  parsePriceJpy,
  parseRebuildabilityTerm,
  parseSewageTerm,
  parseWalkingDistance,
} from "@/lib/discovery/japanese-terms";

// Era 9 / Phase AH — Manual / Assisted Intake.
//
// Aucune source municipale vérifiée (Phase AG, puis re-vérifié en ciblant
// spécifiquement les mairies) n'expose de CSV/JSON/API en libre-service :
// chaque banque d'akiya municipale ne publie que des pages HTML lisibles
// par un humain, sans condition de réutilisation automatisée publiée. Le
// scraping est explicitement exclu par la section 8 de la mission.
//
// Ce module opérationnalise donc le niveau 3 (recherche assistée) : un
// humain lit une page d'annonce municipale et recopie les champs bruts
// tels qu'affichés ; ce module se contente d'appliquer les mêmes
// parseurs de vocabulaire japonais déjà établis en Phase AF (surface,
// prix, 間取り, distance à pied, 再建築可/不可, assainissement) — jamais
// une extraction automatisée du HTML source, jamais un champ deviné
// au-delà de ce que le texte recopié affirme explicitement.

export interface ManualIntakeInput {
  source: string;
  sourceUrl: string | null;
  sourceListingId: string;

  title: string | null;
  // Texte brut recopié tel quel, conservé dans description sans
  // réinterprétation au-delà de ce que les parseurs ci-dessous en tirent.
  descriptionRaw: string | null;

  priceRaw: string | null;

  prefecture: string | null;
  municipality: string | null;
  municipalityCode: string | null;
  address: string | null;

  landAreaRaw: string | null;
  buildingAreaRaw: string | null;
  floorPlanRaw: string | null;
  buildingYearRaw: string | null;

  propertyType: string | null;

  // Jardin/parking : jamais déduits d'un texte libre ambigu — l'humain
  // qui recopie l'annonce affirme directement ce qu'il a constaté, ou
  // laisse null s'il n'a pas l'information.
  hasGarden: boolean | null;
  hasParking: boolean | null;

  nearestStation: string | null;
  stationDistanceRaw: string | null;

  rebuildabilityRaw: string | null;
  sewageRaw: string | null;

  availabilityStatus: ListingAvailabilityStatus;
}

export function createEmptyManualIntakeInput(): ManualIntakeInput {
  return {
    source: "",
    sourceUrl: null,
    sourceListingId: "",
    title: null,
    descriptionRaw: null,
    priceRaw: null,
    prefecture: null,
    municipality: null,
    municipalityCode: null,
    address: null,
    landAreaRaw: null,
    buildingAreaRaw: null,
    floorPlanRaw: null,
    buildingYearRaw: null,
    propertyType: null,
    hasGarden: null,
    hasParking: null,
    nearestStation: null,
    stationDistanceRaw: null,
    rebuildabilityRaw: null,
    sewageRaw: null,
    availabilityStatus: "UNKNOWN",
  };
}

// Construit un PropertyListing à partir d'une saisie assistée. Chaque
// champ brut passe par son parseur dédié ; un texte non reconnu reste
// null (jamais une valeur devinée) — exactement la même discipline que
// les parseurs eux-mêmes.
export function buildPropertyListingFromManualIntake(
  id: string,
  input: ManualIntakeInput,
  retrievedAt: string = new Date().toISOString(),
): PropertyListing {
  const listing = createEmptyPropertyListing(id, input.source, input.sourceListingId, retrievedAt);

  const buildingYear = input.buildingYearRaw ? parseBuildingYearTerm(input.buildingYearRaw) : null;
  const floorPlan = input.floorPlanRaw ? parseFloorPlan(input.floorPlanRaw) : null;
  const stationDistance = input.stationDistanceRaw ? parseWalkingDistance(input.stationDistanceRaw) : null;

  return {
    ...listing,
    sourceUrl: input.sourceUrl,
    title: input.title,
    description: input.descriptionRaw,
    priceJpy: input.priceRaw ? parsePriceJpy(input.priceRaw) : null,
    prefecture: input.prefecture,
    municipality: input.municipality,
    municipalityCode: input.municipalityCode,
    address: input.address,
    landAreaM2: input.landAreaRaw ? parseAreaM2(input.landAreaRaw) : null,
    buildingAreaM2: input.buildingAreaRaw ? parseAreaM2(input.buildingAreaRaw) : null,
    roomCount: floorPlan?.roomCount ?? null,
    floorPlanRaw: input.floorPlanRaw,
    buildingYear,
    buildingEra: buildingYear !== null ? getBuildingEraCode(buildingYear) : null,
    propertyType: input.propertyType,
    hasGarden: input.hasGarden,
    hasParking: input.hasParking,
    nearestStation: input.nearestStation,
    stationDistance,
    roadAccess: null,
    rebuildability: input.rebuildabilityRaw ? parseRebuildabilityTerm(input.rebuildabilityRaw) : null,
    water: null,
    electricity: null,
    gas: null,
    sewage: input.sewageRaw ? parseSewageTerm(input.sewageRaw) : null,
    septicTank: null,
    availabilityStatus: input.availabilityStatus,
    rawData: input,
  };
}
