"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { computeHistoryDiffs } from "@/lib/history";
import { formatEur, formatJpy } from "@/lib/format";
import type { HistoryEntry } from "@/lib/types";

interface HistorySectionProps {
  entries: HistoryEntry[];
  currentTravauxJpy: number;
  currentOpportunityScore: number | null;
  eurJpyRate: number;
  onCheckpoint: () => void;
  onDelete: (id: string) => void;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDelta(value: number, format: (n: number) => string): string {
  if (value === 0) return "";
  return value > 0 ? `▲ +${format(value)}` : `▼ ${format(value)}`;
}

export function HistorySection({
  entries,
  currentTravauxJpy,
  currentOpportunityScore,
  eurJpyRate,
  onCheckpoint,
  onDelete,
}: HistorySectionProps) {
  const diffs = computeHistoryDiffs(entries);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          📌 Historique du projet
        </h2>
      </div>
      <p className="mb-5 text-lg text-foreground">
        Comment ton évaluation de ce bien a évolué dans le temps
      </p>

      <Card className="border-border p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Enregistre un point d&apos;étape pour garder une trace des hypothèses actuelles
            (prix, travaux, taux, note). Utile avant/après une visite ou une négociation.
          </p>
          <Button size="sm" onClick={onCheckpoint}>
            📌 Enregistrer un point d&apos;étape
          </Button>
        </div>

        {diffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun point d&apos;étape enregistré pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-3">
            {diffs
              .slice()
              .reverse()
              .map(({ entry, previous, priceDeltaJpy, travauxDeltaJpy, scoreDelta }) => (
                <li key={entry.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">
                      {DATE_FORMATTER.format(new Date(entry.timestamp))}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-auto p-0 text-xs text-muted-foreground"
                      onClick={() => onDelete(entry.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                  <ul className="space-y-1 text-foreground">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Prix saisi</span>
                      <span>
                        {formatJpy(entry.housePriceJpy)}
                        {previous && priceDeltaJpy !== null && priceDeltaJpy !== 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatDelta(priceDeltaJpy, formatJpy)}
                          </span>
                        )}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Travaux estimés</span>
                      <span>
                        {formatJpy(entry.travauxJpy)}
                        {previous && travauxDeltaJpy !== null && travauxDeltaJpy !== 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatDelta(travauxDeltaJpy, formatJpy)}
                          </span>
                        )}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Taux EUR/JPY utilisé</span>
                      <span>{entry.eurJpyRate}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Note d&apos;opportunité</span>
                      <span>
                        {entry.opportunityScore !== null ? `${entry.opportunityScore.toFixed(1)} / 10` : "—"}
                        {previous && scoreDelta !== null && scoreDelta !== 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {scoreDelta > 0 ? `▲ +${scoreDelta.toFixed(1)}` : `▼ ${scoreDelta.toFixed(1)}`}
                          </span>
                        )}
                      </span>
                    </li>
                  </ul>
                </li>
              ))}
          </ul>
        )}

        <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          Point d&apos;étape actuel (non enregistré) : {formatJpy(currentTravauxJpy)} de travaux estimés
          {" ("}
          {formatEur(currentTravauxJpy / eurJpyRate)}
          {")"}, note{" "}
          {currentOpportunityScore !== null ? `${currentOpportunityScore.toFixed(1)} / 10` : "non calculée"}.
        </div>
      </Card>
    </motion.section>
  );
}
