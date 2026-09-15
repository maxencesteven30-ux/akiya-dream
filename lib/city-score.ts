import type { PolygonHazardCategory } from "@/lib/hazard/provider";
import type { AmenityCategory, AmenitySearchStatus } from "@/lib/amenities/provider";
import type { StationSearchStatus } from "@/lib/stations/provider";

// Note de ville (0-100) — synthèse pédagogique de 4 axes déjà mesurés
// par les moteurs réels de l'application (démographie e-Stat, risques
// MLIT, services de proximité MLIT, gares MLIT). Même discipline que
// lib/opportunity.ts : aucune donnée inventée, chaque sous-score dérive
// d'un chiffre réel déjà affiché ailleurs dans l'app, les poids et les
// courbes de conversion sont des règles métier explicitement
// documentées (pas des mesures), et un axe sans donnée disponible est
// EXCLU du calcul (poids redistribué) plutôt que neutralisé à une valeur
// par défaut arbitraire.
//
// Portée volontairement limitée à ce que les APIs déjà intégrées
// mesurent réellement : il n'existe pas de dataset MLIT "loisirs" dédié
// dans ce projet — l'axe Services réutilise les 5 catégories
// d'équipements essentiels déjà câblées (dont "équipement culturel",
// proxy le plus proche des loisirs parmi les données réelles
// disponibles, jamais présenté comme une mesure du tourisme ou des
// loisirs au sens large).

export type CityScoreAxisKey = "demographie" | "risques" | "services" | "gare";

const WEIGHT_DEMOGRAPHIE = 25;
const WEIGHT_RISQUES = 25;
const WEIGHT_SERVICES = 25;
const WEIGHT_GARE = 25;

export interface CityScoreAxis {
  key: CityScoreAxisKey;
  label: string;
  score: number; // 0-10
  weight: number;
  justification: string;
}

export type CityScoreCategory = "faible" | "moyenne" | "bonne" | "tres_bonne";

export interface CityScoreResult {
  score: number | null; // 0-100, null si aucun axe n'a de donnée
  category: CityScoreCategory | null;
  axes: CityScoreAxis[];
  coverageIncomplete: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function categorizeCityScore(score: number): CityScoreCategory {
  if (score < 4) return "faible";
  if (score < 6) return "moyenne";
  if (score < 8) return "bonne";
  return "tres_bonne";
}

// Taux d'évolution démographique (e-Stat, réel, mesuré) -> score 0-10.
// Calibrage (règle métier, documentée, pas une mesure) : +1%/an ou plus
// = 10 (croissance nette), 0% = 6 (stabilité, ni signal positif ni
// négatif franc), -5%/an ou moins = 0 (déclin marqué). Linéaire entre
// ces trois points.
function scoreDemographie(ratePercent: number | null): CityScoreAxis | null {
  if (ratePercent === null) return null;
  const raw = ratePercent >= 0 ? 6 + ratePercent * 4 : 6 + ratePercent * 1.2;
  const score = round1(clamp(raw, 0, 10));
  const justification =
    ratePercent >= 0
      ? `Population en évolution de ${ratePercent > 0 ? "+" : ""}${ratePercent.toFixed(1)}% sur la période mesurée par e-Stat.`
      : `Population en déclin de ${ratePercent.toFixed(1)}% sur la période mesurée par e-Stat.`;
  return { key: "demographie", label: "Démographie", score, weight: WEIGHT_DEMOGRAPHIE, justification };
}

export interface CityScoreHazardInput {
  category: PolygonHazardCategory;
  status: "IN_ZONE" | "OUTSIDE_ZONE" | "INSUFFICIENT_PRECISION" | "DATA_UNAVAILABLE" | "ERROR";
}

const HAZARD_DETERMINATE_STATUSES = new Set(["IN_ZONE", "OUTSIDE_ZONE"]);

// Nombre de zones de risque MLIT (crue/submersion/glissement de
// terrain/tsunami) dans lesquelles le point tombe -> score 0-10. Règle
// métier documentée : 0 zone = 10, 1 zone = 6, 2 zones = 3, 3 zones et
// plus = 0. Seules les catégories au statut déterminé (IN_ZONE ou
// OUTSIDE_ZONE) comptent ; une catégorie ERROR/DATA_UNAVAILABLE/
// INSUFFICIENT_PRECISION n'est ni un risque confirmé ni une absence de
// risque confirmée, donc exclue du dénombrement.
function scoreRisques(hazards: CityScoreHazardInput[]): CityScoreAxis | null {
  const determinate = hazards.filter((h) => HAZARD_DETERMINATE_STATUSES.has(h.status));
  if (determinate.length === 0) return null;
  const inZoneCount = determinate.filter((h) => h.status === "IN_ZONE").length;
  const score = round1(clamp(10 - inZoneCount * 3.5, 0, 10));
  const justification =
    inZoneCount === 0
      ? `Aucune zone de risque MLIT détectée parmi les ${determinate.length} catégorie(s) vérifiée(s).`
      : `${inZoneCount} zone(s) de risque MLIT détectée(s) sur ${determinate.length} catégorie(s) vérifiée(s).`;
  return { key: "risques", label: "Risques naturels", score, weight: WEIGHT_RISQUES, justification };
}

export interface CityScoreAmenityInput {
  category: AmenityCategory;
  status: AmenitySearchStatus;
  nearestDistanceMeters: number | null;
}

// Distance au service essentiel le plus proche (moyenne des catégories
// trouvées) -> score 0-10. Règle métier documentée : 0m = 10, 5000m ou
// plus = 0, linéaire entre les deux (soit -2 points par km).
function scoreServices(amenities: CityScoreAmenityInput[]): CityScoreAxis | null {
  const found = amenities.filter((a) => a.status === "FOUND" && a.nearestDistanceMeters !== null);
  if (found.length === 0) return null;
  const perCategoryScores = found.map((a) => clamp(10 - (a.nearestDistanceMeters! / 1000) * 2, 0, 10));
  const avg = perCategoryScores.reduce((sum, s) => sum + s, 0) / perCategoryScores.length;
  const score = round1(avg);
  const justification = `${found.length} type(s) de service essentiel trouvé(s) à proximité (MLIT, données ponctuelles à l'échelle de la tuile consultée).`;
  return { key: "services", label: "Services de proximité", score, weight: WEIGHT_SERVICES, justification };
}

export interface CityScoreStationInput {
  status: StationSearchStatus;
  nearestDistanceMeters: number | null;
  nearestJrDistanceMeters: number | null;
}

// Distance à la gare la plus proche -> score de base 0-10 (mêmes
// bornes que Services : 0m = 10, 5000m = 0). Bonus documenté de +1
// (plafonné à 10) si une gare desservie par une compagnie JR figure
// parmi les gares trouvées dans la même tuile : le réseau JR relie
// structurellement à un réseau grandes lignes, un signal réel
// (l'exploitant vient du champ MLIT S12_002_ja) au-delà de la simple
// proximité.
function scoreGare(station: CityScoreStationInput | null): CityScoreAxis | null {
  if (!station || station.status !== "FOUND" || station.nearestDistanceMeters === null) return null;
  const base = clamp(10 - (station.nearestDistanceMeters / 1000) * 2, 0, 10);
  const hasNearbyJr = station.nearestJrDistanceMeters !== null && station.nearestJrDistanceMeters <= 5000;
  const score = round1(clamp(base + (hasNearbyJr ? 1 : 0), 0, 10));
  const distanceKm = (station.nearestDistanceMeters / 1000).toFixed(1);
  const justification = hasNearbyJr
    ? `Gare la plus proche à ${distanceKm} km, dont une ligne JR à proximité (réseau grandes lignes).`
    : `Gare la plus proche à ${distanceKm} km (réseau non-JR ou JR au-delà de 5 km).`;
  return { key: "gare", label: "Gare & réseau ferré", score, weight: WEIGHT_GARE, justification };
}

export interface ComputeCityScoreInput {
  populationChangeRatePercent: number | null;
  hazards: CityScoreHazardInput[];
  amenities: CityScoreAmenityInput[];
  station: CityScoreStationInput | null;
}

export function computeCityScore(input: ComputeCityScoreInput): CityScoreResult {
  const candidates: (CityScoreAxis | null)[] = [
    scoreDemographie(input.populationChangeRatePercent),
    scoreRisques(input.hazards),
    scoreServices(input.amenities),
    scoreGare(input.station),
  ];
  const axes = candidates.filter((a): a is CityScoreAxis => a !== null);

  if (axes.length === 0) {
    return { score: null, category: null, axes: [], coverageIncomplete: true };
  }

  const totalWeight = axes.reduce((sum, a) => sum + a.weight, 0);
  const weightedSum = axes.reduce((sum, a) => sum + a.score * a.weight, 0);
  const score = Math.round(clamp((weightedSum / totalWeight) * 10, 0, 100));

  return {
    score,
    category: categorizeCityScore(score / 10),
    axes,
    coverageIncomplete: axes.length < 4,
  };
}
