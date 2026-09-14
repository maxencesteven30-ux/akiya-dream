import { computeMarketComparison, type ComparableSubject, type MarketComparison } from "@/lib/comparable-transactions";
import { computePriceAnomaly, type PriceAnomalyResult } from "@/lib/price-anomaly";
import type { RealityDataStatus } from "@/lib/reality-data";
import type { MlitTransaction } from "@/lib/mlit/types";

// Phase AK — Market Context.
//
// Volontairement séparé d'Opportunity (lib/opportunity.ts, jamais
// modifié ici) : Opportunity mesure un rapport prix/travaux/localisation
// interne au moteur d'Akiya Dream, Market Context mesure comment le prix
// demandé se situe par rapport à de vraies transactions. Les deux
// coexistent, ne se remplacent jamais l'un l'autre.

export type MarketContextLevel = "favorable" | "neutre" | "defavorable" | "indisponible";

export const MARKET_CONTEXT_LABELS: Record<MarketContextLevel, string> = {
  favorable: "🟢 Prix inférieur aux comparables disponibles",
  neutre: "⚪ Prix dans la fourchette des comparables disponibles",
  defavorable: "🔴 Prix supérieur aux comparables disponibles",
  indisponible: "🟠 Données insuffisantes",
};

export interface MarketContext {
  level: MarketContextLevel;
  comparison: MarketComparison;
  anomaly: PriceAnomalyResult;
}

const DATA_BEARING_STATUSES: RealityDataStatus[] = ["AVAILABLE", "NOT_FOUND"];

export function computeMarketContext(
  askingPriceJpy: number,
  providerStatus: RealityDataStatus,
  subject: ComparableSubject,
  transactions: MlitTransaction[],
): MarketContext {
  const comparison = computeMarketComparison(subject, transactions);
  const anomaly = computePriceAnomaly(
    askingPriceJpy,
    providerStatus,
    DATA_BEARING_STATUSES.includes(providerStatus) ? comparison : null,
  );

  const level: MarketContextLevel =
    anomaly.status === "LOWER_THAN_AVAILABLE_COMPARABLES"
      ? "favorable"
      : anomaly.status === "HIGHER_THAN_AVAILABLE_COMPARABLES"
        ? "defavorable"
        : anomaly.status === "WITHIN_AVAILABLE_RANGE"
          ? "neutre"
          : "indisponible";

  return { level, comparison, anomaly };
}
