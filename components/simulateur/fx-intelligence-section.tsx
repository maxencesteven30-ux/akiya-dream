"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { computeFxSensitivity, fetchEurJpyRate, FX_SENSITIVITY_DISCLAIMER, type FxRate } from "@/lib/fx";
import type { RealityDataResult } from "@/lib/reality-data";

// Phase AF — FX Intelligence.
//
// Rafraîchissement manuel explicite (jamais automatique au montage, ni
// re-déclenché à chaque modification du formulaire) — l'utilisateur
// décide quand interroger la source. Le taux reste toujours accompagné
// de sa source et de sa date, jamais affiché seul.

interface FxIntelligenceSectionProps {
  onRateFetched?: (rate: FxRate) => void;
}

export function FxIntelligenceSection({ onRateFetched }: FxIntelligenceSectionProps) {
  const [result, setResult] = useState<RealityDataResult<FxRate> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    const nextResult = await fetchEurJpyRate();
    setResult(nextResult);
    setLoading(false);
    if (nextResult.status === "AVAILABLE" && nextResult.data) {
      onRateFetched?.(nextResult.data);
    }
  };

  const sensitivity = result?.data ? computeFxSensitivity(result.data.rate) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          💱 FX Intelligence
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Taux EUR/JPY réellement sourcé et daté — jamais une prédiction du marché des changes.
      </p>

      <Card className="border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {result?.status === "AVAILABLE" && result.data && (
              <>
                <p className="text-2xl font-semibold text-foreground">
                  1 € = {result.data.rate.toLocaleString("fr-FR")} ¥
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Source : {result.metadata.sourceName} · Taux du {result.metadata.sourceDate} · Consulté le{" "}
                  {new Date(result.metadata.fetchedAt).toLocaleString("fr-FR")}
                </p>
              </>
            )}
            {result?.status === "ERROR" && (
              <p className="text-sm text-destructive">
                Impossible de récupérer le taux actuellement — réessayez plus tard.
              </p>
            )}
            {result?.status === "NOT_FOUND" && (
              <p className="text-sm text-muted-foreground">
                La source n&apos;a renvoyé aucun taux exploitable.
              </p>
            )}
            {result === null && (
              <p className="text-sm text-muted-foreground">
                Aucun taux consulté pour l&apos;instant.
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? "Consultation..." : "🔄 Rafraîchir le taux EUR/JPY"}
          </Button>
        </div>

        {sensitivity && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Simulation de sensibilité
            </p>
            <div className="mt-2 grid grid-cols-5 gap-2 text-center text-xs">
              {sensitivity.map((point) => (
                <div key={point.deltaPercent} className="rounded-md border border-border p-2">
                  <p className="text-muted-foreground">
                    {point.deltaPercent > 0 ? "+" : ""}
                    {point.deltaPercent}%
                  </p>
                  <p className="mt-1 font-medium text-foreground">{point.rate.toFixed(2)} ¥</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{FX_SENSITIVITY_DISCLAIMER}</p>
          </div>
        )}
      </Card>
    </motion.section>
  );
}
