// AD.2 — conversion coordonnées GPS → tuile XYZ (Web Mercator standard),
// nécessaire pour interroger XPT002 (地価公示・地価調査). Formule
// standard "slippy map" (OSM/Google Maps), pas une approximation
// maison — vérifiée contre un appel réel le 2026-09-14 : (36.65, 138.18)
// à z=14 → (x=14480, y=6397), confirmé par une réponse XPT002 réelle
// contenant des points à city_code=20201 (Nagano).

export interface Tile {
  z: number;
  x: number;
  y: number;
}

// z14 : compromis documenté par l'API elle-même (plage autorisée 13-15) —
// une tuile fait environ 2,4 km de large à cette latitude, assez fine
// pour rester pertinente localement, assez large pour ne pas dépendre
// d'une précision GPS au mètre près.
export const DEFAULT_LAND_PRICE_ZOOM = 14;

export function latLonToTile(latitude: number, longitude: number, zoom: number): Tile {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((longitude + 180) / 360) * n);
  const latRad = (latitude * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { z: zoom, x, y };
}
