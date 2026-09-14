import type { GeographicPrecision, RealityDataConfidence } from "@/lib/reality-data";

// Phase AM — Hazard Data Contract.
//
// Contrat SEUL — pas de moteur GIS. Pas de conversion de coordonnées en
// tuiles XYZ, pas d'intersection polygonale, pas de téléchargement de
// données. Les 5 catégories couvertes correspondent à celles réellement
// documentées par le "不動産情報ライブラリ" (Phase AA/AC, API prévention
// des risques) — aucune catégorie inventée.
//
// Aucun verdict de sécurité automatique à ce stade : ce module ne fait
// que définir la forme qu'aura un futur résultat, toujours
// DATA_UNAVAILABLE tant que le moteur GIS n'existe pas.

export type HazardCategory = "flood" | "landslide" | "tsunami" | "storm_surge" | "evacuation_shelter";

export const HAZARD_CATEGORY_LABELS: Record<HazardCategory, string> = {
  flood: "🌊 Inondation (zone d'inondation maximale prévue)",
  landslide: "⛰️ Glissement de terrain",
  tsunami: "🌊 Tsunami",
  storm_surge: "🌊 Submersion marine",
  evacuation_shelter: "🏫 Abri d'urgence désigné",
};

export type HazardZoneStatus =
  | "IN_ZONE"
  | "OUTSIDE_ZONE"
  | "INSUFFICIENT_PRECISION"
  | "DATA_UNAVAILABLE"
  | "ERROR";

export interface HazardCheckMetadata {
  sourceName: string;
  sourceUrl?: string;
  sourceDate?: string;
  fetchedAt: string;
  geographicPrecision: GeographicPrecision;
  confidence?: RealityDataConfidence;
  // Référence à la géométrie/dataset source une fois le moteur GIS
  // construit (ex. identifiant de tuile, version du jeu de données).
  geometryReference?: string;
}

export interface HazardCheckResult {
  category: HazardCategory;
  status: HazardZoneStatus;
  metadata: HazardCheckMetadata;
}

const HAZARD_SOURCE_NAME = "MLIT — 不動産情報ライブラリ (防災情報API, moteur GIS non implémenté)";

// Seule une localisation EXACTE (coordonnées) justifierait, une fois le
// moteur GIS construit, une intersection géographique fiable — cf.
// lib/geo-precision.ts::hasSufficientPrecisionForHazardAnalysis, réutilisé
// ici plutôt que redéfini.
export function checkHazardZone(
  category: HazardCategory,
  precision: GeographicPrecision,
): HazardCheckResult {
  const fetchedAt = new Date().toISOString();

  if (precision !== "EXACT") {
    return {
      category,
      status: "INSUFFICIENT_PRECISION",
      metadata: { sourceName: HAZARD_SOURCE_NAME, fetchedAt, geographicPrecision: precision },
    };
  }

  // Le contrat existe, le moteur GIS n'existe pas encore (Phase AM =
  // sandbox uniquement) : toujours DATA_UNAVAILABLE, jamais un verdict
  // inventé, même avec une localisation précise.
  return {
    category,
    status: "DATA_UNAVAILABLE",
    metadata: { sourceName: HAZARD_SOURCE_NAME, fetchedAt, geographicPrecision: precision },
  };
}
