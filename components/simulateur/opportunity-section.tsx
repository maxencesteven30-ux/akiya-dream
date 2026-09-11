"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  computeOpportunityScore,
  OPPORTUNITY_CATEGORY_LABELS,
  OPPORTUNITY_CONFIDENCE_LABELS,
  OPPORTUNITY_DISCLAIMER,
  OPPORTUNITY_VERIFICATION_REMINDER,
  getOpportunityHeadline,
  type OpportunityCategory,
  type OpportunityConfidenceLevel,
} from "@/lib/opportunity";
import { formatEur, formatJpy } from "@/lib/format";
import type { BuyerProfile, RealListing, Region, RenovationLevel } from "@/lib/types";

interface OpportunitySectionProps {
  prixAchatJpy: number;
  profile: BuyerProfile;
  renovationLevel: RenovationLevel;
  region: Region | null;
  realListing: RealListing | null;
}

const CATEGORY_STYLES: Record<OpportunityCategory, string> = {
  faible: "border-destructive/30 bg-destructive/5",
  risquee: "border-amber-600/30 bg-amber-600/5",
  interessante: "border-amber-500/30 bg-amber-500/5",
  bonne: "border-emerald-600/30 bg-emerald-600/5",
  tres_bonne: "border-emerald-600/40 bg-emerald-600/10",
};

const CONFIDENCE_STYLES: Record<OpportunityConfidenceLevel, string> = {
  low: "text-destructive",
  medium: "text-amber-600",
  high: "text-emerald-600",
};

export function OpportunitySection({
  prixAchatJpy,
  profile,
  renovationLevel,
  region,
  realListing,
}: OpportunitySectionProps) {
  const [analyzed, setAnalyzed] = useState(false);

  const result = useMemo(() => {
    if (!realListing) return null;
    return computeOpportunityScore({
      prixAchatJpy,
      profile,
      renovationLevel,
      region,
      listing: realListing,
    });
  }, [prixAchatJpy, profile, renovationLevel, region, realListing]);

  if (!realListing) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          🏠 J&apos;ai trouvé une akiya
        </h2>
      </div>
      <p className="mb-5 text-lg text-foreground">Cette maison est-elle une bonne opportunité ?</p>

      {!analyzed || !result ? (
        <Card className="border-border p-6 sm:p-8">
          <p className="mb-4 text-sm text-muted-foreground">
            À partir des informations du bien réel renseigné ci-dessus, Akiya Dream calcule une
            note d&apos;opportunité sur 10 — un score d&apos;attractivité du projet, pas une
            estimation de valeur vénale ni une expertise.
          </p>
          <Button onClick={() => setAnalyzed(true)}>Analyser cette opportunité</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className={`border p-6 sm:p-8 ${CATEGORY_STYLES[result.category]}`}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Note d&apos;opportunité
                </p>
                <p className="text-5xl font-semibold text-foreground">
                  {result.score.toFixed(1)}
                  <span className="text-lg font-normal text-muted-foreground"> / 10</span>
                </p>
                <p className="mt-1 text-base font-medium text-foreground">
                  {OPPORTUNITY_CATEGORY_LABELS[result.category]}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Confiance</p>
                <p className={`text-lg font-semibold ${CONFIDENCE_STYLES[result.confidence]}`}>
                  {OPPORTUNITY_CONFIDENCE_LABELS[result.confidence]}
                </p>
              </div>
            </div>

            {result.coverageIncomplete && (
              <p className="mb-4 text-xs text-muted-foreground">
                Certaines données sont inconnues : la note est moins fiable.
              </p>
            )}

            <p className="text-sm text-foreground">{getOpportunityHeadline(result.category)}</p>
          </Card>

          <Card className="border-border p-6 sm:p-8">
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Détail des critères
            </p>
            <div className="space-y-4">
              {result.subScores.map((sub) => (
                <div key={sub.key}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {sub.label} ({sub.weight}%)
                    </span>
                    <span className="text-foreground">{sub.score.toFixed(1)} / 10</span>
                  </div>
                  <Progress value={sub.score * 10} />
                  <p className="mt-1 text-xs text-muted-foreground">{sub.justification}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-border p-6 sm:p-8">
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Coût total du projet
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Prix demandé</span>
                <span className="text-foreground">{formatJpy(result.budget.prixAchatJpy)}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Frais d&apos;acquisition</span>
                <span className="text-foreground">
                  {formatJpy(result.budget.acquisitionFees.total)}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Travaux estimés</span>
                <span className="text-foreground">{formatJpy(result.budget.travauxJpy)}</span>
              </li>
              <li className="flex justify-between border-t border-border pt-1.5 font-medium">
                <span className="text-foreground">Projet total estimé</span>
                <span className="text-foreground">{formatJpy(result.budget.totalProjetJpy)}</span>
              </li>
              <li className="flex justify-end text-xs text-muted-foreground">
                soit {formatEur(result.budget.totalProjetEur)}
              </li>
            </ul>

            <Separator className="my-4" />

            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Scénarios travaux
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {result.scenarios.map((scenario) => (
                <div
                  key={scenario.label}
                  className={`rounded-md border p-3 text-sm ${
                    scenario.label === "realiste" ? "border-primary/40 bg-accent/30" : "border-border"
                  }`}
                >
                  <p className="mb-1 font-medium text-foreground">
                    {scenario.label === "optimiste"
                      ? "Optimiste"
                      : scenario.label === "realiste"
                        ? "Réaliste (référence)"
                        : "Prudent"}
                  </p>
                  <p className="text-foreground">{formatJpy(scenario.totalProjetJpy)}</p>
                  <p className="text-xs text-muted-foreground">
                    soit {formatEur(scenario.totalProjetEur)}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {(result.strengths.length > 0 || result.riskFlags.length > 0) && (
            <div className="grid gap-6 sm:grid-cols-2">
              {result.strengths.length > 0 && (
                <Card className="border-border p-6">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pourquoi cette opportunité est intéressante
                  </p>
                  <ul className="space-y-2 text-sm">
                    {result.strengths.map((strength, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden="true">✅</span>
                        <span className="text-foreground">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {result.riskFlags.length > 0 && (
                <Card className="border-border p-6">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Ce qui mérite une vérification
                  </p>
                  <ul className="space-y-2 text-sm">
                    {result.riskFlags.map((flag) => (
                      <li key={flag.key} className="flex gap-2">
                        <span aria-hidden="true">⚠️</span>
                        <span className="text-foreground">{flag.message}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            <p>{OPPORTUNITY_VERIFICATION_REMINDER}</p>
            <p>{OPPORTUNITY_DISCLAIMER}</p>
          </div>

          <div>
            <Button variant="ghost" size="sm" onClick={() => setAnalyzed(false)}>
              Réinitialiser l&apos;analyse
            </Button>
          </div>
        </div>
      )}
    </motion.section>
  );
}
