"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RealityDataResult } from "@/lib/reality-data";
import type { PopulationYearPoint } from "@/lib/demographics/population-mesh";
import type { EstatResult } from "@/lib/estat-contract";

// Era 9 (suite) — Demographics Section, câblage UI de deux moteurs
// réels et complémentaires construits précédemment : XKT013 (projection
// par cellule 250m, modélisée, MLIT) et e-Stat (recensement réel par
// commune entière, mesuré). Jamais fusionnés en un seul chiffre — les
// deux restent visibles séparément avec leur propre source, une
// modélisation ne devient jamais silencieusement un fait mesuré.
//
// Même discipline de rafraîchissement strictement manuel que Market
// Context/Hazard Section.

interface DemographicsSectionProps {
  latitude: number | null;
  longitude: number | null;
  municipalityCode: string | null;
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function DemographicsSection({ latitude, longitude, municipalityCode }: DemographicsSectionProps) {
  const [meshResult, setMeshResult] = useState<RealityDataResult<PopulationYearPoint[]> | null>(null);
  const [population, setPopulation] = useState<EstatResult | null>(null);
  const [households, setHouseholds] = useState<EstatResult | null>(null);
  const [changeRate, setChangeRate] = useState<EstatResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const meshParams = new URLSearchParams();
      if (latitude !== null) meshParams.set("latitude", String(latitude));
      if (longitude !== null) meshParams.set("longitude", String(longitude));
      const meshResponse = await fetch(`/api/demographics?${meshParams}`);
      setMeshResult(await meshResponse.json());

      if (municipalityCode) {
        const [popRes, hhRes, rateRes] = await Promise.all([
          fetch(`/api/estat?municipalityCode=${municipalityCode}&indicator=population`),
          fetch(`/api/estat?municipalityCode=${municipalityCode}&indicator=households`),
          fetch(`/api/estat?municipalityCode=${municipalityCode}&indicator=population_change_rate`),
        ]);
        setPopulation(await popRes.json());
        setHouseholds(await hhRes.json());
        setChangeRate(await rateRes.json());
      } else {
        setPopulation(null);
        setHouseholds(null);
        setChangeRate(null);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const meshPoints = meshResult?.status === "AVAILABLE" ? meshResult.data ?? [] : [];
  const meshFirst = meshPoints[0] ?? null;
  const meshLast = meshPoints[meshPoints.length - 1] ?? null;

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          🏘️ Démographie de la commune
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Deux sources officielles distinctes, jamais fusionnées : le recensement e-Stat (mesuré, à l&apos;échelle
        de la commune) et la projection MLIT par cellule de 250m (modélisée).
      </p>

      <Card className="border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {population || meshResult
              ? "Dernière consultation ci-dessous."
              : fetchError
                ? "Impossible de consulter la démographie actuellement."
                : "Aucune consultation pour l'instant."}
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? "Consultation..." : "🔄 Consulter la démographie"}
          </Button>
        </div>

        {(population || households || changeRate) && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              e-Stat — recensement réel par commune
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Population</p>
                {population?.status === "AVAILABLE" && population.data ? (
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {population.data.value.toLocaleString("fr-FR")}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({population.data.period})
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Non disponible</p>
                )}
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Ménages</p>
                {households?.status === "AVAILABLE" && households.data ? (
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {households.data.value.toLocaleString("fr-FR")}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({households.data.period})
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Non disponible</p>
                )}
              </div>
              <div
                className={`rounded-md border p-3 ${
                  changeRate?.status === "AVAILABLE" && changeRate.data
                    ? changeRate.data.value < 0
                      ? "border-amber-600/30 bg-amber-600/5"
                      : "border-emerald-600/30 bg-emerald-600/5"
                    : "border-border"
                }`}
              >
                <p className="text-xs text-muted-foreground">Évolution</p>
                {changeRate?.status === "AVAILABLE" && changeRate.data ? (
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatSignedPercent(changeRate.data.value)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({changeRate.data.period})
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Non disponible</p>
                )}
              </div>
            </div>
          </div>
        )}

        {meshResult && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              MLIT — projection par cellule de 250m (modélisée)
            </p>
            {meshResult.status === "AVAILABLE" && meshFirst && meshLast ? (
              <p className="mt-2 text-sm text-foreground">
                {meshFirst.totalPopulation !== null ? Math.round(meshFirst.totalPopulation) : "—"}
                {" "}({meshFirst.year}) → {meshLast.totalPopulation !== null ? Math.round(meshLast.totalPopulation) : "—"}
                {" "}({meshLast.year})
                {meshLast.elderlyRatio75Plus !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Ratio 75 ans et plus en {meshLast.year} : {(meshLast.elderlyRatio75Plus * 100).toFixed(1)}%
                  </span>
                )}
              </p>
            ) : meshResult.status === "INSUFFICIENT_LOCATION" ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Renseignez les coordonnées GPS exactes du bien pour cette projection.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Non disponible.</p>
            )}
          </div>
        )}

        {!municipalityCode && (
          <p className="mt-3 text-xs text-muted-foreground">
            Renseignez le code municipal MLIT du bien (section « Bien réel trouvé ») pour interroger e-Stat.
          </p>
        )}
      </Card>
    </motion.section>
  );
}
