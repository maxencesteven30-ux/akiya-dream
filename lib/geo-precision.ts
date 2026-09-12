import type { GeographicPrecision } from "@/lib/reality-data";

// Phase AB — Localisation du bien.
//
// Une analyse de risque précise ne doit jamais être faite sur une
// localisation imprécise sans le dire explicitement. Ce module dérive la
// précision géographique disponible depuis ce que l'utilisateur a
// réellement renseigné — jamais une précision supposée par défaut.

export interface LocationInput {
  city: string;
  // Typé `number | null`, mais vérifié avec `typeof === "number"` plutôt
  // que `!== null` : un état persisté avant l'ajout de ce champ peut
  // contenir `undefined` (clé absente), qui n'est pas strictement égal à
  // `null` mais ne doit jamais être traité comme une coordonnée valide.
  latitude: number | null;
  longitude: number | null;
}

export function computeGeographicPrecision(input: LocationInput): GeographicPrecision {
  if (typeof input.latitude === "number" && typeof input.longitude === "number") return "EXACT";
  if (input.city.trim() !== "") return "MUNICIPALITY";
  return "INSUFFICIENT";
}

// Garde-fou explicite : seule une localisation EXACTE (coordonnées) doit
// permettre une analyse de risque géographique précise (intersection
// avec une couche officielle) — une municipalité seule reste trop
// imprécise pour affirmer quoi que ce soit sur une parcelle donnée.
export function hasSufficientPrecisionForHazardAnalysis(precision: GeographicPrecision): boolean {
  return precision === "EXACT";
}

const LATITUDE_RANGE: [number, number] = [-90, 90];
const LONGITUDE_RANGE: [number, number] = [-180, 180];

export function isValidLatitude(value: number): boolean {
  return value >= LATITUDE_RANGE[0] && value <= LATITUDE_RANGE[1];
}

export function isValidLongitude(value: number): boolean {
  return value >= LONGITUDE_RANGE[0] && value <= LONGITUDE_RANGE[1];
}
