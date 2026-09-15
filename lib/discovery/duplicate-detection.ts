import type { PropertyListing } from "@/lib/discovery/property-listing";
import { haversineDistanceMeters } from "@/lib/amenities/distance";

// Era 9 (suite) — Phase 2, section 34 de la mission : détection de
// doublons entre sources différentes. La même annonce ressaisie deux
// fois sous la MÊME source (même source + sourceListingId) est déjà
// gérée en amont par lib/discovery/candidate-listings.ts (upsert, jamais
// deux entrées) — ce module traite uniquement le cas où DEUX SOURCES
// différentes décrivent probablement le même bien physique.
//
// Règle centrale (section 34) : "Ne jamais fusionner deux biens sur une
// simple ressemblance textuelle faible. Si doute : POSSIBLE_DUPLICATE."
// Ce module ne fusionne donc JAMAIS deux annonces — il se contente de
// signaler une paire pour vérification humaine. Aucun signal n'est
// utilisé s'il est absent d'un des deux côtés (jamais une comparaison
// devinée).

// Seuils explicitement documentés comme des règles de gestion, pas des
// normes officielles — distincts de SURFACE_TOLERANCE_RATIO
// (lib/comparable-transactions.ts, 40%, pensé pour la comparabilité de
// marché) : ici la question est "est-ce littéralement le même bâtiment
// ?", une tolérance beaucoup plus stricte est donc justifiée.
export const DUPLICATE_COORDINATE_PROXIMITY_METERS = 50;
export const DUPLICATE_SURFACE_TOLERANCE_RATIO = 0.05;

export type DuplicateSignal =
  | "same_municipality"
  | "close_coordinates"
  | "same_address"
  | "same_price"
  | "similar_surface"
  | "same_building_year";

export type DuplicateVerdict = "POSSIBLE_DUPLICATE" | "NOT_ENOUGH_SIGNAL" | "DIFFERENT_MUNICIPALITY";

export interface DuplicatePairResult {
  listingIdA: string;
  listingIdB: string;
  verdict: DuplicateVerdict;
  matchedSignals: DuplicateSignal[];
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, "");
}

// Deux signaux "forts" (coordonnées proches, adresse identique) suffisent
// seuls à justifier une vérification humaine. Les signaux "faibles" pris
// isolément (même prix, même surface, même année) sont trop communs pour
// en être un — il en faut au moins 3 réunis, aucun signal fort requis,
// pour atteindre le même niveau de doute raisonnable.
const MIN_WEAK_SIGNALS_WITHOUT_STRONG_SIGNAL = 3;

export function compareListingsForDuplicate(a: PropertyListing, b: PropertyListing): DuplicatePairResult {
  const matchedSignals: DuplicateSignal[] = [];

  if (a.municipalityCode !== null && b.municipalityCode !== null) {
    if (a.municipalityCode !== b.municipalityCode) {
      return { listingIdA: a.id, listingIdB: b.id, verdict: "DIFFERENT_MUNICIPALITY", matchedSignals: [] };
    }
    matchedSignals.push("same_municipality");
  }

  let hasStrongSignal = false;

  if (a.latitude !== null && a.longitude !== null && b.latitude !== null && b.longitude !== null) {
    const distanceMeters = haversineDistanceMeters(a.latitude, a.longitude, b.latitude, b.longitude);
    if (distanceMeters <= DUPLICATE_COORDINATE_PROXIMITY_METERS) {
      matchedSignals.push("close_coordinates");
      hasStrongSignal = true;
    }
  }

  if (a.address !== null && b.address !== null && a.address.trim() !== "" && b.address.trim() !== "") {
    if (normalizeAddress(a.address) === normalizeAddress(b.address)) {
      matchedSignals.push("same_address");
      hasStrongSignal = true;
    }
  }

  let weakSignalCount = 0;

  if (a.priceJpy !== null && b.priceJpy !== null && a.priceJpy === b.priceJpy) {
    matchedSignals.push("same_price");
    weakSignalCount += 1;
  }

  if (a.buildingAreaM2 !== null && b.buildingAreaM2 !== null) {
    const larger = Math.max(a.buildingAreaM2, b.buildingAreaM2);
    const delta = Math.abs(a.buildingAreaM2 - b.buildingAreaM2);
    if (larger > 0 && delta / larger <= DUPLICATE_SURFACE_TOLERANCE_RATIO) {
      matchedSignals.push("similar_surface");
      weakSignalCount += 1;
    }
  }

  if (a.buildingYear !== null && b.buildingYear !== null && a.buildingYear === b.buildingYear) {
    matchedSignals.push("same_building_year");
    weakSignalCount += 1;
  }

  const verdict: DuplicateVerdict =
    hasStrongSignal || weakSignalCount >= MIN_WEAK_SIGNALS_WITHOUT_STRONG_SIGNAL
      ? "POSSIBLE_DUPLICATE"
      : "NOT_ENOUGH_SIGNAL";

  return { listingIdA: a.id, listingIdB: b.id, verdict, matchedSignals };
}

// Ne compare que des paires de SOURCES différentes — un doublon au sein
// d'une même source est déjà résolu par l'upsert de
// candidate-listings.ts, le recomparer ici serait redondant.
export function findPossibleDuplicates(listings: PropertyListing[]): DuplicatePairResult[] {
  const results: DuplicatePairResult[] = [];
  for (let i = 0; i < listings.length; i++) {
    for (let j = i + 1; j < listings.length; j++) {
      const a = listings[i];
      const b = listings[j];
      if (a.source === b.source) continue;
      const result = compareListingsForDuplicate(a, b);
      if (result.verdict === "POSSIBLE_DUPLICATE") results.push(result);
    }
  }
  return results;
}
