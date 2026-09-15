import type { PropertyListing } from "@/lib/discovery/property-listing";
import {
  computeCityScore,
  type CityScoreAmenityInput,
  type CityScoreHazardInput,
  type CityScorePriorities,
  type CityScoreResult,
  type CityScoreStationInput,
} from "@/lib/city-score";
import { JAPAN_PREFECTURES } from "@/lib/japan-prefectures";
import type { PolygonHazardCategory } from "@/lib/hazard/provider";
import type { AmenityCategory } from "@/lib/amenities/provider";

// Era 9 (suite) — pont Discovery -> City Score (onglet Ville).
//
// N'introduit aucune nouvelle logique de score : construit uniquement
// les entrées de computeCityScore (lib/city-score.ts, inchangé) à
// partir d'un PropertyListing, en réutilisant les mêmes routes déjà
// utilisées par l'onglet Ville (components/simulateur/city-section.tsx)
// pour un choix manuel de commune — /api/estat, /api/hazard,
// /api/amenities, /api/stations, /api/geocoding/municipality-center.
//
// Résolution du point géographique, par ordre de préférence :
// 1. Les coordonnées PROPRES du listing quand elles existent (précision
//    EXACT — jamais remplacées par un centre-ville approximatif quand
//    une adresse réelle est déjà connue).
// 2. Un centre-ville GSI approximatif, MAIS seulement si le champ libre
//    `listing.prefecture` correspond EXACTEMENT (nom japonais ou
//    libellé anglais connu) à l'une des 47 préfectures réelles — jamais
//    une correspondance approximative ou devinée sur un texte libre non
//    fiable (cf. lib/discovery/manual-intake.ts : `prefecture` est une
//    chaîne libre, pas un code vérifié).
// Si ni l'un ni l'autre n'est disponible, seul l'axe démographie
// (qui ne dépend que du code municipal, jamais de coordonnées) peut
// encore être calculé.

const HAZARD_CATEGORIES: PolygonHazardCategory[] = ["flood", "tsunami", "landslide", "storm_surge"];
const AMENITY_CATEGORIES: AmenityCategory[] = ["school", "medical", "welfare", "cultural", "town_hall"];

function resolveKnownPrefecture(prefectureRaw: string | null) {
  if (!prefectureRaw) return null;
  const normalized = prefectureRaw.trim().toLowerCase();
  return (
    JAPAN_PREFECTURES.find(
      (p) => p.nameJa === prefectureRaw.trim() || p.label.toLowerCase() === normalized,
    ) ?? null
  );
}

interface GeoPoint {
  latitude: number;
  longitude: number;
}

async function resolveCenterPoint(
  listing: PropertyListing,
  fetchImpl: typeof fetch,
): Promise<GeoPoint | null> {
  if (listing.latitude !== null && listing.longitude !== null) {
    return { latitude: listing.latitude, longitude: listing.longitude };
  }

  const jpPrefecture = resolveKnownPrefecture(listing.prefecture);
  if (!jpPrefecture || !listing.municipality) return null;

  const res = await fetchImpl(
    `/api/geocoding/municipality-center?prefectureNameJa=${encodeURIComponent(jpPrefecture.nameJa)}&municipalityNameJa=${encodeURIComponent(listing.municipality)}`,
  ).then((r) => r.json());
  return res.point ?? null;
}

export async function fetchListingCityScore(
  listing: PropertyListing,
  priorities?: CityScorePriorities,
  fetchImpl: typeof fetch = fetch,
): Promise<CityScoreResult | null> {
  let populationChangeRatePercent: number | null = null;
  if (listing.municipalityCode) {
    const rateRes = await fetchImpl(
      `/api/estat?municipalityCode=${listing.municipalityCode}&indicator=population_change_rate`,
    ).then((r) => r.json());
    if (rateRes.status === "AVAILABLE" && rateRes.data) populationChangeRatePercent = rateRes.data.value;
  }

  const point = await resolveCenterPoint(listing, fetchImpl);

  let hazards: CityScoreHazardInput[] = [];
  let amenities: CityScoreAmenityInput[] = [];
  let station: CityScoreStationInput | null = null;

  if (point) {
    const hazardResponses = await Promise.all(
      HAZARD_CATEGORIES.map((category) =>
        fetchImpl(`/api/hazard?category=${category}&latitude=${point.latitude}&longitude=${point.longitude}`).then(
          (r) => r.json(),
        ),
      ),
    );
    hazards = HAZARD_CATEGORIES.map((category, i) => ({ category, status: hazardResponses[i].status }));

    const amenityResponses = await Promise.all(
      AMENITY_CATEGORIES.map((category) =>
        fetchImpl(`/api/amenities?category=${category}&latitude=${point.latitude}&longitude=${point.longitude}`).then(
          (r) => r.json(),
        ),
      ),
    );
    amenities = AMENITY_CATEGORIES.map((category, i) => {
      const res = amenityResponses[i];
      const nearest = res.amenities?.[0] ?? null;
      return { category, status: res.status, nearestDistanceMeters: nearest?.distanceMeters ?? null };
    });

    const stationRes = await fetchImpl(
      `/api/stations?latitude=${point.latitude}&longitude=${point.longitude}`,
    ).then((r) => r.json());
    const nearest = stationRes.stations?.[0] ?? null;
    const nearestJr = (stationRes.stations ?? []).find((s: { info: { operator: string } }) =>
      s.info.operator.startsWith("JR"),
    );
    station = {
      status: stationRes.status,
      nearestDistanceMeters: nearest?.distanceMeters ?? null,
      nearestJrDistanceMeters: nearestJr?.distanceMeters ?? null,
    };
  }

  if (populationChangeRatePercent === null && hazards.length === 0 && amenities.length === 0 && !station) {
    return null;
  }

  return computeCityScore({ populationChangeRatePercent, hazards, amenities, station }, priorities);
}
