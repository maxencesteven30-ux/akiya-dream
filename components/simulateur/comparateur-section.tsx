"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/simulateur/money";
import { compareProperties, getBestDeal } from "@/lib/comparison";
import type { Region, SavedProject } from "@/lib/types";

interface ComparateurSectionProps {
  projects: SavedProject[];
  onRemove: (id: string) => void;
  capitalDisponibleEur: number | null;
  reserveSecuriteEur: number | null;
  regions: Region[];
}

const PROFILE_LABELS = {
  solo: "Solo",
  duo: "À deux",
  investisseur: "Investisseur",
};

const RENOVATION_LABELS = {
  leger: "Léger",
  standard: "Standard",
  lourd: "Lourd",
};

export function ComparateurSection({
  projects,
  onRemove,
  capitalDisponibleEur,
  reserveSecuriteEur,
  regions,
}: ComparateurSectionProps) {
  const comparisons = useMemo(() => {
    return compareProperties(
      projects.map((property) => ({
        property,
        region: regions.find((r) => r.prefecture === property.prefecture) ?? null,
        capitalDisponibleEur,
        reserveSecuriteEur,
      })),
    );
  }, [projects, regions, capitalDisponibleEur, reserveSecuriteEur]);

  const bestDeal = useMemo(() => getBestDeal(comparisons), [comparisons]);

  if (projects.length === 0) return null;

  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        🔍 Comparateur
      </h2>
      <p className="mb-5 text-lg text-foreground">
        {projects.length} bien{projects.length > 1 ? "s" : ""} comparé{projects.length > 1 ? "s" : ""}{" "}
        (maximum 3)
      </p>

      <Card className="overflow-x-auto border-border p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Prix</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Note /10</th>
              <th className="px-4 py-3 font-medium">Verdict</th>
              <th className="px-4 py-3 font-medium">Durée</th>
              <th className="px-4 py-3 font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {comparisons.map((comparison) => {
              const project = projectById.get(comparison.propertyId);
              const isBest = bestDeal?.propertyId === comparison.propertyId;
              return (
                <tr
                  key={comparison.propertyId}
                  className={`border-b border-border last:border-b-0 ${
                    isBest ? "bg-emerald-600/5" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {isBest && <span aria-hidden="true">🏆 </span>}
                    {comparison.name}
                    {project && (
                      <p className="text-xs font-normal text-muted-foreground">
                        {PROFILE_LABELS[project.profile]} ·{" "}
                        {RENOVATION_LABELS[project.renovationLevel]}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {project && <Money jpy={project.housePriceJpy} className="text-foreground" />}
                  </td>
                  <td className="px-4 py-3">
                    <Money jpy={comparison.totalBudgetJpy} className="text-foreground" />
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {comparison.opportunityScore !== null
                      ? comparison.opportunityScore.toFixed(1)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {comparison.feasibilityVerdict ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    ~{comparison.renovationDurationMonths} mois
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground"
                      onClick={() => onRemove(comparison.propertyId)}
                      aria-label={`Retirer ${comparison.name} du comparateur`}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Note /10 et verdict non disponibles (—) si le bien n&apos;a pas de région/état renseignés,
        ou si le budget disponible n&apos;a pas été saisi à l&apos;étape 4. Durée de chantier : une
        estimation indicative par niveau de travaux, pas une donnée mesurée.
      </p>
    </motion.section>
  );
}
