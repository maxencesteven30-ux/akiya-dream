"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { computeHistoryDiffs, findVisitComparison } from "@/lib/history";
import { formatEur, formatJpy } from "@/lib/format";
import type { HistoryEntry } from "@/lib/types";

interface HistorySectionProps {
  entries: HistoryEntry[];
  currentTravauxJpy: number;
  currentOpportunityScore: number | null;
  eurJpyRate: number;
  onCheckpoint: (isPostVisit: boolean) => void;
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
  const [markAsVisit, setMarkAsVisit] = useState(false);
  const diffs = computeHistoryDiffs(entries);
  const visitComparison = findVisitComparison(entries);

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

      {visitComparison && (
        <Card className="mb-6 border-primary/40 bg-accent/20 p-6 sm:p-8">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            🔍 Avant / Après visite
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium"></th>
                  <th className="pb-2 font-medium">Avant la visite</th>
                  <th className="pb-2 font-medium">Après la visite</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-muted-foreground">Travaux estimés</td>
                  <td className="py-1.5 text-foreground">{formatJpy(visitComparison.before.travauxJpy)}</td>
                  <td className="py-1.5 text-foreground">{formatJpy(visitComparison.after.travauxJpy)}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-muted-foreground">Coût total du projet</td>
                  <td className="py-1.5 text-foreground">{formatJpy(visitComparison.before.totalProjetJpy)}</td>
                  <td className="py-1.5 text-foreground">{formatJpy(visitComparison.after.totalProjetJpy)}</td>
                </tr>
                <tr className="border-t border-border font-medium">
                  <td className="py-1.5 text-muted-foreground">Note d&apos;opportunité</td>
                  <td className="py-1.5 text-foreground">
                    {visitComparison.before.opportunityScore !== null
                      ? `${visitComparison.before.opportunityScore.toFixed(1)} / 10`
                      : "—"}
                  </td>
                  <td className="py-1.5 text-foreground">
                    {visitComparison.after.opportunityScore !== null
                      ? `${visitComparison.after.opportunityScore.toFixed(1)} / 10`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="border-border p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Enregistre un point d&apos;étape pour garder une trace des hypothèses actuelles
            (prix, travaux, taux, note). Utile avant/après une visite ou une négociation.
          </p>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button size="sm" onClick={() => onCheckpoint(markAsVisit)}>
              📌 Enregistrer un point d&apos;étape
            </Button>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={markAsVisit} onCheckedChange={(checked) => setMarkAsVisit(checked === true)} />
              Après une visite du bien
            </label>
          </div>
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
                      {entry.isPostVisit && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                          🔍 Après visite
                        </span>
                      )}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-auto p-0 text-xs text-muted-foreground"
                      aria-label={`Supprimer le point d'étape du ${DATE_FORMATTER.format(new Date(entry.timestamp))}`}
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
