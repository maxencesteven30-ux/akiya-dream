import type { OfficialLandPricePoint } from "@/lib/mlit/land-price-types";

// Moyenne du prix foncier officiel (地価公示・地価調査, XPT002) sur les
// points réels trouvés dans la tuile consultée — jamais une seule valeur
// présentée comme représentative de toute la commune sans indiquer la
// taille de l'échantillon.
export interface AverageLandPricePerSqm {
  averagePricePerSqmJpy: number;
  sampleSize: number;
}

export function computeAverageLandPricePerSqm(
  points: OfficialLandPricePoint[],
): AverageLandPricePerSqm | null {
  if (points.length === 0) return null;
  const total = points.reduce((sum, p) => sum + p.pricePerSqmJpy, 0);
  return { averagePricePerSqmJpy: Math.round(total / points.length), sampleSize: points.length };
}
