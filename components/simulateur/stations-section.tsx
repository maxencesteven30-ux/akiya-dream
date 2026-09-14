"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StationSearchResult } from "@/lib/stations/provider";

// Era 9 (suite) — Stations Section, câblage UI du moteur de
// fréquentation des gares (XKT015). Même discipline de rafraîchissement
// strictement manuel que les autres sections MLIT.

const MAX_STATIONS_SHOWN = 2;

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

interface StationsSectionProps {
  latitude: number | null;
  longitude: number | null;
}

export function StationsSection({ latitude, longitude }: StationsSectionProps) {
  const [result, setResult] = useState<StationSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams();
      if (latitude !== null) params.set("latitude", String(latitude));
      if (longitude !== null) params.set("longitude", String(longitude));
      const response = await fetch(`/api/stations?${params}`);
      setResult(await response.json());
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          🚉 Gares à proximité
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Fréquentation réelle par gare (国土数値情報, 2011-2023) — une ligne rurale en forte baisse de
        fréquentation peut annoncer une réduction de service, jamais une prédiction ici, seulement
        l&apos;historique constaté.
      </p>

      <Card className="border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {result
              ? "Dernière consultation ci-dessous."
              : fetchError
                ? "Impossible de consulter les gares actuellement."
                : "Aucune consultation pour l'instant."}
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? "Consultation..." : "🔄 Consulter les gares"}
          </Button>
        </div>

        {result?.status === "FOUND" && (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            {result.stations.slice(0, MAX_STATIONS_SHOWN).map((station) => {
              const first = station.info.ridership[0] ?? null;
              const last = station.info.ridership[station.info.ridership.length - 1] ?? null;
              return (
                <div key={station.info.name} className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">
                    {station.info.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({formatDistance(station.distanceMeters)})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {station.info.operator} — {station.info.line}
                  </p>
                  {last ? (
                    <p className="mt-1 text-xs text-foreground">
                      {last.passengers.toLocaleString("fr-FR")} voyageurs/jour ({last.year})
                      {first && first.year !== last.year && (
                        <span className="ml-1 text-muted-foreground">
                          — {first.passengers.toLocaleString("fr-FR")} en {first.year}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Aucune fréquentation publiée.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {result?.status === "NONE_IN_TILE" && (
          <p className="mt-3 text-xs text-muted-foreground">Aucune gare trouvée dans la zone recherchée.</p>
        )}

        {(latitude === null || longitude === null) && (
          <p className="mt-3 text-xs text-muted-foreground">
            Renseignez les coordonnées GPS exactes du bien (section « Bien réel trouvé ») pour cette
            recherche.
          </p>
        )}
      </Card>
    </motion.section>
  );
}
