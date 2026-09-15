import type { PropertyListing } from "@/lib/discovery/property-listing";
import { computeMarketContext, type MarketContext } from "@/lib/market-context";
import type { ComparableSubject } from "@/lib/comparable-transactions";
import { recentQuarters } from "@/lib/mlit/price-stats";
import type { MlitTransaction } from "@/lib/mlit/types";
import type { RealityDataResult } from "@/lib/reality-data";

// Era 9 (suite) — pont Discovery -> Market Context.
//
// N'introduit aucun nouveau moteur de comparaison : appelle exactement
// computeMarketContext (lib/market-context.ts, Phase AK, inchangé) après
// avoir récupéré de vraies transactions MLIT via la même route déjà
// utilisée par l'onglet Ville (/api/mlit/transactions) et le même
// découpage en trimestres (recentQuarters, lib/mlit/price-stats.ts).
//
// Retourne null quand rien de réel n'est exploitable (prix ou commune
// inconnus) — jamais un contexte de marché construit sur une hypothèse.

const QUARTERS_TO_CHECK = 4;

function aggregateStatus(
  results: RealityDataResult<MlitTransaction[]>[],
): RealityDataResult<MlitTransaction[]>["status"] {
  if (results.some((r) => r.status === "AVAILABLE")) return "AVAILABLE";
  if (results.some((r) => r.status === "NOT_FOUND")) return "NOT_FOUND";
  return results[0]?.status ?? "ERROR";
}

export async function fetchListingMarketContext(
  listing: PropertyListing,
  fetchImpl: typeof fetch = fetch,
): Promise<MarketContext | null> {
  if (listing.priceJpy === null || listing.municipalityCode === null) return null;

  const quarters = recentQuarters(new Date(), QUARTERS_TO_CHECK);
  const results: RealityDataResult<MlitTransaction[]>[] = await Promise.all(
    quarters.map((q) =>
      fetchImpl(
        `/api/mlit/transactions?municipalityCode=${listing.municipalityCode}&year=${q.year}&quarter=${q.quarter}`,
      ).then((r) => r.json()),
    ),
  );

  const transactions: MlitTransaction[] = results.flatMap((r) => (r.status === "AVAILABLE" ? (r.data ?? []) : []));
  const providerStatus = aggregateStatus(results);

  const subject: ComparableSubject = {
    municipalityCode: listing.municipalityCode,
    surfaceM2: listing.buildingAreaM2,
    constructionYear: listing.buildingYear,
  };

  return computeMarketContext(listing.priceJpy, providerStatus, subject, transactions);
}
