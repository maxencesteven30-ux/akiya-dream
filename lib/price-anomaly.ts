import type { RealityDataStatus } from "@/lib/reality-data";
import type { MarketComparison } from "@/lib/comparable-transactions";

// Phase AJ — Price Anomaly Detector.
//
// Détecte si le prix demandé est atypique par rapport aux comparables
// réellement disponibles — jamais si "c'est une bonne affaire". Un bien
// très peu cher peut avoir des travaux énormes, aucun droit de
// reconstruire, un accès problématique : ce moteur ne fournit qu'un
// SIGNAL de prix, jamais une conclusion. Il ne touche et n'importe rien
// de lib/opportunity.ts — l'Opportunity Score n'est jamais modifié ici.

export type PriceAnomalyStatus =
  | "LOWER_THAN_AVAILABLE_COMPARABLES"
  | "WITHIN_AVAILABLE_RANGE"
  | "HIGHER_THAN_AVAILABLE_COMPARABLES"
  | "INSUFFICIENT_DATA"
  | "DATA_UNAVAILABLE";

export interface PriceAnomalyResult {
  status: PriceAnomalyStatus;
  askingPriceJpy: number;
  comparablePriceDispersionJpy: { minJpy: number; maxJpy: number } | null;
  message: string;
}

export const PRICE_ANOMALY_DISCLAIMER =
  "Prix atypique ≠ bonne affaire : un écart de prix seul ne dit rien des travaux, de l'accès ou du droit de reconstruire.";

const PROVIDER_UNAVAILABLE_STATUSES: RealityDataStatus[] = ["UNAVAILABLE", "ERROR", "INSUFFICIENT_LOCATION"];

export function computePriceAnomaly(
  askingPriceJpy: number,
  providerStatus: RealityDataStatus,
  marketComparison: MarketComparison | null,
): PriceAnomalyResult {
  if (PROVIDER_UNAVAILABLE_STATUSES.includes(providerStatus)) {
    return {
      status: "DATA_UNAVAILABLE",
      askingPriceJpy,
      comparablePriceDispersionJpy: null,
      message: "Source de transactions indisponible — impossible d'évaluer le positionnement du prix demandé.",
    };
  }

  if (!marketComparison || marketComparison.comparableCount === 0 || !marketComparison.priceDispersionJpy) {
    return {
      status: "INSUFFICIENT_DATA",
      askingPriceJpy,
      comparablePriceDispersionJpy: null,
      message: "Aucune transaction réellement comparable disponible — impossible de situer ce prix.",
    };
  }

  const { minJpy, maxJpy } = marketComparison.priceDispersionJpy;

  if (askingPriceJpy < minJpy) {
    return {
      status: "LOWER_THAN_AVAILABLE_COMPARABLES",
      askingPriceJpy,
      comparablePriceDispersionJpy: marketComparison.priceDispersionJpy,
      message: `Prix inférieur aux transactions comparables disponibles (${minJpy.toLocaleString("fr-FR")}–${maxJpy.toLocaleString("fr-FR")} JPY). ${PRICE_ANOMALY_DISCLAIMER}`,
    };
  }

  if (askingPriceJpy > maxJpy) {
    return {
      status: "HIGHER_THAN_AVAILABLE_COMPARABLES",
      askingPriceJpy,
      comparablePriceDispersionJpy: marketComparison.priceDispersionJpy,
      message: `Prix supérieur aux transactions comparables disponibles (${minJpy.toLocaleString("fr-FR")}–${maxJpy.toLocaleString("fr-FR")} JPY).`,
    };
  }

  return {
    status: "WITHIN_AVAILABLE_RANGE",
    askingPriceJpy,
    comparablePriceDispersionJpy: marketComparison.priceDispersionJpy,
    message: `Prix dans la fourchette des transactions comparables disponibles (${minJpy.toLocaleString("fr-FR")}–${maxJpy.toLocaleString("fr-FR")} JPY).`,
  };
}
