import { haversineDistanceMeters } from "@/lib/amenities/distance";

// Era 9 (suite) — distance point/segment par échantillonnage, pas une
// projection perpendiculaire exacte. Suffisant pour les features XKT015
// (segments réels observés de l'ordre de 100-300m) : l'erreur induite
// est négligeable devant l'usage (proximité indicative à une gare, pas
// une mesure d'ingénierie).

export type Position = [number, number]; // [lon, lat], convention GeoJSON

const SAMPLE_COUNT = 20;

function distanceToSegmentMeters(lat: number, lon: number, start: Position, end: Position): number {
  let min = Infinity;
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const t = i / SAMPLE_COUNT;
    const sampleLon = start[0] + (end[0] - start[0]) * t;
    const sampleLat = start[1] + (end[1] - start[1]) * t;
    const distance = haversineDistanceMeters(lat, lon, sampleLat, sampleLon);
    if (distance < min) min = distance;
  }
  return min;
}

// Une LineString peut avoir plus de deux points (plusieurs segments
// consécutifs) — la distance au tracé complet est le minimum sur
// chaque segment, jamais seulement les deux extrémités globales.
export function distanceToLineStringMeters(lat: number, lon: number, line: Position[]): number {
  if (line.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const distance = distanceToSegmentMeters(lat, lon, line[i], line[i + 1]);
    if (distance < min) min = distance;
  }
  return min;
}
