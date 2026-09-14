// Era 9 (suite) — Hazard Engine, géométrie pure.
//
// Test point-dans-polygone par ray casting (algorithme standard,
// gère les trous) — la seule façon honnête de répondre IN_ZONE/
// OUTSIDE_ZONE à partir d'un FeatureCollection GeoJSON MLIT : la
// simple présence d'une feature dans la tuile ne suffit pas (une
// tuile peut contenir à la fois une zone à risque et une zone hors
// risque), donc jamais utilisée comme raccourci.
//
// Convention GeoJSON : chaque anneau est [lon, lat][], le premier
// anneau est le contour extérieur, les suivants sont des trous.

export type Position = [number, number];
export type LinearRing = Position[];
export type PolygonCoordinates = LinearRing[];

function pointInRing(lon: number, lat: number, ring: LinearRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(lon: number, lat: number, polygon: PolygonCoordinates): boolean {
  if (polygon.length === 0) return false;
  const [outer, ...holes] = polygon;
  if (!pointInRing(lon, lat, outer)) return false;
  return !holes.some((hole) => pointInRing(lon, lat, hole));
}

// MultiPolygon = liste de Polygon. Une feature GeoJSON de type
// "MultiPolygon" a coordinates: PolygonCoordinates[].
export function pointInMultiPolygon(lon: number, lat: number, multiPolygon: PolygonCoordinates[]): boolean {
  return multiPolygon.some((polygon) => pointInPolygon(lon, lat, polygon));
}
