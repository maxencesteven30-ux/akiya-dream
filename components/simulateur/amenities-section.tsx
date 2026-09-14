"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AMENITY_CATEGORY_LABELS, type AmenityCategory, type AmenitySearchResult } from "@/lib/amenities/provider";

// Era 9 (suite) — Amenities Section, câblage UI du moteur de services
// essentiels construit précédemment. Même discipline de
// rafraîchissement strictement manuel que les autres sections MLIT.

const CATEGORIES: AmenityCategory[] = ["school", "medical", "welfare", "cultural", "town_hall"];
const MAX_SHOWN_PER_CATEGORY = 2;

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

interface AmenitiesSectionProps {
  latitude: number | null;
  longitude: number | null;
}

export function AmenitiesSection({ latitude, longitude }: AmenitiesSectionProps) {
  const [results, setResults] = useState<Partial<Record<AmenityCategory, AmenitySearchResult>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const entries = await Promise.all(
        CATEGORIES.map(async (category) => {
          const params = new URLSearchParams({ category });
          if (latitude !== null) params.set("latitude", String(latitude));
          if (longitude !== null) params.set("longitude", String(longitude));
          const response = await fetch(`/api/amenities?${params}`);
          const result: AmenitySearchResult = await response.json();
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
          🏘️ Services essentiels à proximité
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Établissements réels (国土数値情報) les plus proches, dans un rayon d&apos;environ 2,4 km autour du
        bien — l&apos;absence de résultat signifie qu&apos;aucun établissement n&apos;a été trouvé dans cette
        zone de recherche, jamais qu&apos;aucun service n&apos;existe à proximité.
      </p>

      <Card className="border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {results
              ? "Dernière consultation ci-dessous."
              : fetchError
                ? "Impossible de consulter les services essentiels actuellement."
                : "Aucune consultation pour l'instant."}
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? "Consultation..." : "🔄 Consulter les services essentiels"}
          </Button>
        </div>

        {results && (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            {CATEGORIES.map((category) => {
              const result = results[category];
              if (!result) return null;
              return (
                <div key={category} className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">{AMENITY_CATEGORY_LABELS[category]}</p>
                  {result.status === "FOUND" ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {result.amenities.slice(0, MAX_SHOWN_PER_CATEGORY).map((amenity) => (
                        <li key={amenity.name}>
                          {amenity.name}{" "}
                          <span className="text-foreground">({formatDistance(amenity.distanceMeters)})</span>
                        </li>
                      ))}
                    </ul>
                  ) : result.status === "NONE_IN_TILE" ? (
                    <p className="mt-1 text-xs text-muted-foreground">Aucun trouvé dans la zone recherchée.</p>
                  ) : result.status === "INSUFFICIENT_PRECISION" ? (
                    <p className="mt-1 text-xs text-muted-foreground">Coordonnées GPS exactes requises.</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Donnée indisponible.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {latitude === null || longitude === null ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Renseignez les coordonnées GPS exactes du bien (section « Bien réel trouvé ») pour cette
            recherche.
          </p>
        ) : null}
      </Card>
    </motion.section>
  );
}
