"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { computeMarketContext, MARKET_CONTEXT_LABELS, type MarketContext } from "@/lib/market-context";
import { PRICE_ANOMALY_DISCLAIMER } from "@/lib/price-anomaly";
import type { RealityDataResult } from "@/lib/reality-data";
import type { MlitTransaction } from "@/lib/mlit/types";

// Phase AK — Market Context.
//
// Rafraîchissement strictement manuel (même discipline que FX
// Intelligence, Phase AF) : jamais d'appel automatique au montage ni à
// chaque saisie. L'utilisateur déclenche la requête, qui passe par notre
// propre Route Handler (jamais un appel MLIT direct depuis le
// navigateur — interdit par la source elle-même).

interface MarketContextSectionProps {
  askingPriceJpy: number;
  municipalityCode: string | null;
  surfaceM2: number | null;
  constructionYear: number | null;
}

function currentQuarter(date: Date): 1 | 2 | 3 | 4 {
  return (Math.floor(date.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

export function MarketContextSection({
  askingPriceJpy,
  municipalityCode,
  surfaceM2,
  constructionYear,
}: MarketContextSectionProps) {
  const [context, setContext] = useState<MarketContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const handleRefresh = async () => {
    if (!municipalityCode) return;
    setLoading(true);
    setFetchError(false);
    try {
      const now = new Date();
      const params = new URLSearchParams({
        municipalityCode,
        year: String(now.getFullYear() - 1),
        quarter: String(currentQuarter(now)),
      });
      const response = await fetch(`/api/mlit/transactions?${params}`);
      const result: RealityDataResult<MlitTransaction[]> = await response.json();
      setContext(
        computeMarketContext(askingPriceJpy, result.status, { municipalityCode, surfaceM2, constructionYear }, result.data ?? []),
      );
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          📊 Market Context
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Comment le prix demandé se situe par rapport à de vraies transactions MLIT — jamais la valeur du
        bien.
      </p>

      <Card className="border-border p-6">
        {!municipalityCode && (
          <p className="text-sm text-muted-foreground">
            Renseignez le code municipal MLIT du bien (section « Bien réel trouvé ») pour interroger le
            contexte de marché.
          </p>
        )}

        {municipalityCode && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {context ? (
                <>
                  <p className="text-base font-medium text-foreground">{MARKET_CONTEXT_LABELS[context.level]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {context.comparison.comparableCount} comparable(s) sur {context.comparison.totalTransactions}{" "}
                    transaction(s) — {context.comparison.periodsCovered.join(", ") || "aucune période"}
                  </p>
                </>
              ) : fetchError ? (
                <p className="text-sm text-destructive">Impossible de récupérer le contexte de marché actuellement.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune consultation pour l&apos;instant.</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              {loading ? "Consultation..." : "🔄 Consulter le contexte de marché"}
            </Button>
          </div>
        )}

        {context && (
          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            {context.comparison.priceDispersionJpy && (
              <p>
                Fourchette des comparables :{" "}
                {context.comparison.priceDispersionJpy.minJpy.toLocaleString("fr-FR")} –{" "}
                {context.comparison.priceDispersionJpy.maxJpy.toLocaleString("fr-FR")} JPY
              </p>
            )}
            {context.comparison.limits.map((limit) => (
              <p key={limit} className="mt-1">
                {limit}
              </p>
            ))}
            <p className="mt-2">{PRICE_ANOMALY_DISCLAIMER}</p>
          </div>
        )}
      </Card>
    </motion.section>
  );
}
