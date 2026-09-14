"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HAZARD_CATEGORY_LABELS, type HazardCheckResult, type HazardZoneStatus } from "@/lib/hazard-contract";
import type { PolygonHazardCategory } from "@/lib/hazard/provider";

// Era 9 (suite) — Hazard Section, câblage UI du moteur GIS réel
// (XKT026/027/028/029, construit précédemment). Même discipline de
// rafraîchissement strictement manuel que Market Context/FX
// Intelligence : jamais d'appel automatique au montage.

const POLYGON_CATEGORIES: PolygonHazardCategory[] = ["flood", "landslide", "tsunami", "storm_surge"];

const STATUS_STYLES: Record<HazardZoneStatus, string> = {
  IN_ZONE: "border-destructive/30 bg-destructive/5",
  OUTSIDE_ZONE: "border-emerald-600/30 bg-emerald-600/5",
  INSUFFICIENT_PRECISION: "border-amber-600/30 bg-amber-600/5",
  DATA_UNAVAILABLE: "border-border bg-muted/30",
  ERROR: "border-border bg-muted/30",
};

const STATUS_LABELS: Record<HazardZoneStatus, string> = {
  IN_ZONE: "🔴 Dans la zone à risque",
  OUTSIDE_ZONE: "🟢 Hors zone (selon la donnée officielle)",
  INSUFFICIENT_PRECISION: "🟠 Coordonnées GPS exactes requises",
  DATA_UNAVAILABLE: "⚪ Donnée indisponible",
  ERROR: "⚪ Échec de la consultation",
};

interface HazardSectionProps {
  latitude: number | null;
  longitude: number | null;
}

export function HazardSection({ latitude, longitude }: HazardSectionProps) {
  const [results, setResults] = useState<Partial<Record<PolygonHazardCategory, HazardCheckResult>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const entries = await Promise.all(
        POLYGON_CATEGORIES.map(async (category) => {
          const params = new URLSearchParams({ category });
          if (latitude !== null) params.set("latitude", String(latitude));
          if (longitude !== null) params.set("longitude", String(longitude));
          const response = await fetch(`/api/hazard?${params}`);
          const result: HazardCheckResult = await response.json();
          return [category, result] as const;
        }),
      );
      setResults(Object.fromEntries(entries));
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
          🌪️ Risques naturels
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Intersection géographique réelle avec les zones officielles MLIT (inondation, glissement de
        terrain, tsunami, submersion marine) — jamais un verdict de sécurité global, chaque catégorie reste
        indépendante.
      </p>

      <Card className="border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {results
              ? "Dernière consultation ci-dessous."
              : fetchError
                ? "Impossible de consulter les risques naturels actuellement."
                : "Aucune consultation pour l'instant."}
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? "Consultation..." : "🔄 Consulter les risques naturels"}
          </Button>
        </div>

        {results && (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            {POLYGON_CATEGORIES.map((category) => {
              const result = results[category];
              if (!result) return null;
              return (
                <div key={category} className={`rounded-md border p-3 ${STATUS_STYLES[result.status]}`}>
                  <p className="text-sm font-medium text-foreground">{HAZARD_CATEGORY_LABELS[category]}</p>
                  <p className="mt-1 text-xs text-foreground">{STATUS_LABELS[result.status]}</p>
                </div>
              );
            })}
          </div>
        )}

        {latitude === null || longitude === null ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Renseignez les coordonnées GPS exactes du bien (section « Bien réel trouvé ») — une
            municipalité seule ne permet pas une intersection géographique fiable.
          </p>
        ) : null}
      </Card>
    </motion.section>
  );
}
