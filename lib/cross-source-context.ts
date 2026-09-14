import { computeMedian, type MarketComparison } from "@/lib/comparable-transactions";
import type { OfficialLandPricePoint } from "@/lib/mlit/land-price-types";
import type { RealityDataStatus } from "@/lib/reality-data";

// AD.3 — Cross-Source Intelligence.
//
// Croise prix demandé + transactions comparables (AD.1) + prix foncier
// officiel (AD.2) + caractéristiques du bien. AUCUN nouveau score : ce
// module produit des FACTS, des DERIVED_VALUES, un CONTEXTE et des
// UNKNOWN, jamais une conclusion "cette maison vaut X" ni un chiffre
// remplaçant Opportunity/Risk/Feasibility/Completeness (inchangés,
// zéro import de ces moteurs).

export type SourceConcordance = "SOURCES_CONCORDANT" | "SOURCES_NOT_DIRECTLY_COMPARABLE" | "INSUFFICIENT_DATA";

export interface CrossSourceContextInput {
  askingPriceJpy: number;
  landM2: number | null;
  transactionsStatus: RealityDataStatus;
  marketComparison: MarketComparison | null;
  landPriceStatus: RealityDataStatus;
  landPricePoints: OfficialLandPricePoint[];
}

export interface CrossSourceContext {
  transactionsAvailable: boolean;
  landPriceAvailable: boolean;
  concordance: SourceConcordance;
  // Valeur foncière implicite = médiane des prix fonciers officiels
  // (JPY/m²) × surface du terrain déclarée — une DERIVED_VALUE calculée
  // par Akiya Dream, jamais un fait externe : le prix foncier officiel
  // porte sur le terrain seul, pas sur le bien terrain+bâtiment.
  impliedLandValueJpy: number | null;
  medianLandPricePerSqmJpy: number | null;
  // Phrases hedgées prêtes à l'affichage, dans l'esprit de l'exemple de
  // formulation attendu (AD.3.6) — jamais une conclusion catégorique.
  narrative: string[];
  unknowns: string[];
}

const NO_TRANSACTIONS_DATA_STATUSES: RealityDataStatus[] = ["UNAVAILABLE", "ERROR", "INSUFFICIENT_LOCATION"];

export function computeCrossSourceContext(input: CrossSourceContextInput): CrossSourceContext {
  const transactionsAvailable = input.transactionsStatus === "AVAILABLE";
  const landPriceAvailable = input.landPriceStatus === "AVAILABLE" && input.landPricePoints.length > 0;

  const medianLandPricePerSqmJpy = landPriceAvailable
    ? computeMedian(input.landPricePoints.map((p) => p.pricePerSqmJpy))
    : null;

  const impliedLandValueJpy =
    medianLandPricePerSqmJpy !== null && input.landM2 !== null
      ? Math.round(medianLandPricePerSqmJpy * input.landM2)
      : null;

  const narrative: string[] = [];
  const unknowns: string[] = [];

  if (transactionsAvailable && input.marketComparison) {
    const mc = input.marketComparison;
    narrative.push(
      `${mc.comparableCount} transaction(s) comparable(s) identifiée(s) selon les critères actuels sur ${mc.totalTransactions} transaction(s) disponible(s). Leur dispersion fournit un contexte de marché local, mais ne constitue pas une estimation de la valeur de cette propriété.`,
    );
  } else if (NO_TRANSACTIONS_DATA_STATUSES.includes(input.transactionsStatus)) {
    unknowns.push("Transactions comparables : source indisponible.");
  } else {
    unknowns.push("Transactions comparables : aucune donnée pour cette période/localisation.");
  }

  if (landPriceAvailable && impliedLandValueJpy !== null) {
    narrative.push(
      `Le prix foncier officiel disponible (médiane ${medianLandPricePerSqmJpy?.toLocaleString("fr-FR")} JPY/m²) constitue une information distincte concernant le terrain et ne permet pas, à lui seul, d'estimer la valeur totale du bien.`,
    );
  } else if (NO_TRANSACTIONS_DATA_STATUSES.includes(input.landPriceStatus)) {
    unknowns.push("Prix foncier officiel : source indisponible.");
  } else if (input.landM2 === null && landPriceAvailable) {
    unknowns.push("Prix foncier officiel disponible mais surface du terrain non renseignée.");
  } else {
    unknowns.push("Prix foncier officiel : aucun point disponible pour cette localisation.");
  }

  let concordance: SourceConcordance;
  if (!transactionsAvailable && !landPriceAvailable) {
    concordance = "INSUFFICIENT_DATA";
  } else if (impliedLandValueJpy === null || !input.marketComparison?.priceDispersionJpy) {
    concordance = "INSUFFICIENT_DATA";
  } else if (impliedLandValueJpy > input.marketComparison.priceDispersionJpy.maxJpy) {
    // La valeur foncière implicite (terrain seul) dépasse la transaction
    // comparable la plus chère (terrain + bâtiment) — logiquement
    // incohérent sauf explication distincte (parcelles non comparables,
    // erreur de saisie de surface...) : signalé, jamais ignoré.
    concordance = "SOURCES_NOT_DIRECTLY_COMPARABLE";
    narrative.push(
      "La valeur foncière implicite dépasse la fourchette des transactions comparables disponibles — les deux sources ne sont pas directement comparables pour ce bien, à vérifier avant toute conclusion.",
    );
  } else {
    concordance = "SOURCES_CONCORDANT";
  }

  narrative.push(
    "Information susceptible de modifier le verdict : qualité et représentativité des comparables, état réel du bâtiment, droits de reconstruction et caractéristiques exactes du terrain.",
  );

  return {
    transactionsAvailable,
    landPriceAvailable,
    concordance,
    impliedLandValueJpy,
    medianLandPricePerSqmJpy,
    narrative,
    unknowns,
  };
}
