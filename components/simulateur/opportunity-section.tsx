"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  computeOpportunityScore,
  FEASIBILITY_LABELS,
  OPPORTUNITY_CATEGORY_LABELS,
  OPPORTUNITY_CONFIDENCE_LABELS,
  OPPORTUNITY_DISCLAIMER,
  OPPORTUNITY_VERIFICATION_REMINDER,
  getOpportunityHeadline,
  type FeasibilityLevel,
  type OpportunityCategory,
  type OpportunityConfidenceLevel,
} from "@/lib/opportunity";
import { Money } from "@/components/simulateur/money";
import { jpyToEur } from "@/lib/data";
import { formatEur, formatJpy } from "@/lib/format";
import type { BuyerProfile, RealListing, Region, RenovationLevel } from "@/lib/types";

interface OpportunitySectionProps {
  prixAchatJpy: number;
  profile: BuyerProfile;
  renovationLevel: RenovationLevel;
  region: Region | null;
  realListing: RealListing | null;
  capitalDisponibleEur: number | null;
  reserveSecuriteEur: number | null;
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

const FEASIBILITY_STYLES: Record<FeasibilityLevel, string> = {
  compatible: "border-emerald-600/30 bg-emerald-600/5",
  tendu: "border-amber-600/30 bg-amber-600/5",
  insuffisant: "border-destructive/30 bg-destructive/5",
};

export function OpportunitySection({
  prixAchatJpy,
  profile,
  renovationLevel,
  region,
  realListing,
  capitalDisponibleEur,
  reserveSecuriteEur,
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
      capitalDisponibleEur,
      reserveSecuriteEur,
    });
  }, [prixAchatJpy, profile, renovationLevel, region, realListing, capitalDisponibleEur, reserveSecuriteEur]);

  if (!realListing) return null;

  const maxSensitivityTotal = result
    ? Math.max(...result.scenarios.map((s) => s.totalProjetJpy))
    : 0;

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
            note d&apos;opportunité sur 10 — un score d&apos;attractivité économique du projet à
            partir des données disponibles, pas une estimation immobilière professionnelle.
          </p>
          <Button onClick={() => setAnalyzed(true)}>Analyser cette opportunité</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 1-2. Note /10 + Opportunité */}
          <Card className={`border p-6 sm:p-8 ${CATEGORY_STYLES[result.category]}`}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  🏠 Opportunité du bien
                </p>
                <p className="text-5xl font-semibold text-foreground">
                  {result.score.toFixed(1)}
                  <span className="text-lg font-normal text-muted-foreground"> / 10</span>
                </p>
                <p className="mt-1 text-base font-medium text-foreground">
                  {OPPORTUNITY_CATEGORY_LABELS[result.category]}
                </p>
              </div>
              {result.feasibility && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    💰 Faisabilité du projet
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {FEASIBILITY_LABELS[result.feasibility]}
                  </p>
                </div>
              )}
            </div>

            {result.coverageIncomplete && (
              <p className="mb-4 text-xs text-muted-foreground">
                Certaines données sont inconnues : la note est moins fiable.
              </p>
            )}

            <p className="text-sm text-foreground">{getOpportunityHeadline(result.category)}</p>

            <Separator className="my-4" />

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              💰 Analyse du prix
            </p>
            <ul className="mb-4 space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Prix demandé</span>
                <Money jpy={result.priceAnalysis.prixAchatJpy} className="text-foreground" />
              </li>
              {result.priceAnalysis.referenceRegionaleJpy !== null ? (
                <>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Référence régionale</span>
                    <Money
                      jpy={result.priceAnalysis.referenceRegionaleJpy}
                      className="text-foreground"
                    />
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Écart</span>
                    <span className="text-foreground">
                      {result.priceAnalysis.ecartPercent! > 0 ? "+" : ""}
                      {result.priceAnalysis.ecartPercent}%
                    </span>
                  </li>
                </>
              ) : (
                <li className="text-xs text-muted-foreground">Référence régionale indisponible.</li>
              )}
            </ul>

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              🧠 Ce que dit l&apos;analyse
            </p>
            <p className="text-sm text-foreground">{result.narrative}</p>

            <Separator className="my-4" />

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

          {/* 3. Coût réel du projet */}
          <Card className="border-border p-6 sm:p-8">
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Coût réel du projet
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Prix d&apos;achat</span>
                <Money jpy={result.budget.prixAchatJpy} className="text-foreground" />
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Frais d&apos;acquisition</span>
                <Money jpy={result.budget.acquisitionFees.total} className="text-foreground" />
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Travaux</span>
                <Money jpy={result.budget.travauxJpy} className="text-foreground" />
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Marge d&apos;imprévus (scénario prudent)</span>
                <Money
                  jpy={
                    (result.scenarios.find((s) => s.label === "prudent")?.travauxJpy ??
                      result.budget.travauxJpy) - result.budget.travauxJpy
                  }
                  className="text-foreground"
                />
              </li>
              <li className="flex justify-between border-t border-border pt-1.5 font-medium">
                <span className="text-foreground">Capital initial estimé</span>
                <Money
                  jpy={
                    result.scenarios.find((s) => s.label === "prudent")?.totalProjetJpy ??
                    result.budget.totalProjetJpy
                  }
                  className="text-foreground"
                />
              </li>
            </ul>
          </Card>

          {/* 4. Faisabilité budgétaire (budget personnel) */}
          {result.budgetVerdict && result.feasibility && (
            <Card className={`border p-6 sm:p-8 ${FEASIBILITY_STYLES[result.feasibility]}`}>
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ton budget
              </p>
              <ul className="space-y-1.5 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Budget disponible</span>
                  <span className="text-foreground">
                    {formatEur(result.budgetVerdict.budgetDisponibleEur)}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Projet estimé</span>
                  <span className="text-foreground">
                    {formatEur(result.budgetVerdict.budgetNecessaireEur)}
                  </span>
                </li>
                <li className="flex justify-between border-t border-border pt-1.5 font-medium">
                  <span className="text-foreground">
                    {result.budgetVerdict.margeEur >= 0 ? "Marge restante" : "Manque"}
                  </span>
                  <span className="text-foreground">
                    {formatEur(Math.abs(result.budgetVerdict.margeEur))}
                  </span>
                </li>
              </ul>
              <p className="mt-4 text-base font-medium text-foreground">
                {FEASIBILITY_LABELS[result.feasibility]}
              </p>
            </Card>
          )}

          {/* 5. Prix cible / zone de négociation */}
          {(result.priceTargets.maxAffordablePriceJpy !== null ||
            result.priceTargets.attractivePriceJpy !== null ||
            result.priceTargets.interestingZone !== null) && (
            <Card className="border-border p-6 sm:p-8">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                🎯 Zone de négociation
              </p>
              <ul className="space-y-1.5 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Prix demandé</span>
                  <Money jpy={prixAchatJpy} className="text-foreground" />
                </li>
                {result.priceTargets.attractivePriceJpy !== null && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Prix cible (attractif)</span>
                    <Money
                      jpy={result.priceTargets.attractivePriceJpy}
                      className="text-foreground"
                    />
                  </li>
                )}
                {result.priceTargets.maxAffordablePriceJpy !== null && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Prix maximum conseillé</span>
                    <Money
                      jpy={result.priceTargets.maxAffordablePriceJpy}
                      className="text-foreground"
                    />
                  </li>
                )}
              </ul>
              {result.priceTargets.negotiationMessage && (
                <p className="mt-4 text-sm text-foreground">
                  {result.priceTargets.negotiationMessage}
                </p>
              )}

              {result.priceTargets.interestingZone && (
                <div className="mt-4 rounded-md border border-primary/40 bg-accent/30 p-3 text-sm">
                  <p className="font-medium text-foreground">🎯 Zone intéressante</p>
                  <p className="text-muted-foreground">
                    {formatJpy(result.priceTargets.interestingZone.minJpy)} –{" "}
                    {formatJpy(result.priceTargets.interestingZone.maxJpy)}
                    <span className="block text-xs">
                      soit {formatEur(jpyToEur(result.priceTargets.interestingZone.minJpy))} –{" "}
                      {formatEur(jpyToEur(result.priceTargets.interestingZone.maxJpy))}
                    </span>
                  </p>
                </div>
              )}

              {result.sensitivity.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Si le prix change...
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="pb-2 font-medium">Prix</th>
                          <th className="pb-2 font-medium">Note</th>
                          <th className="pb-2 text-right font-medium">Projet total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.sensitivity.map((point) => {
                          const inZone =
                            result.priceTargets.interestingZone &&
                            point.prixJpy >= result.priceTargets.interestingZone.minJpy &&
                            point.prixJpy <= result.priceTargets.interestingZone.maxJpy;
                          return (
                            <tr
                              key={point.prixJpy}
                              className={`border-t border-border ${inZone ? "bg-primary/5" : ""}`}
                            >
                              <td className="py-1.5 leading-tight text-foreground">
                                {formatJpy(point.prixJpy)}
                                <span className="block text-xs text-muted-foreground">
                                  ≈ {formatEur(jpyToEur(point.prixJpy))}
                                </span>
                              </td>
                              <td className="py-1.5 font-medium text-foreground">
                                {point.score.toFixed(1)}
                              </td>
                              <td className="py-1.5 text-right leading-tight text-foreground">
                                {formatJpy(point.totalProjetJpy)}
                                <span className="block text-xs text-muted-foreground">
                                  ≈ {formatEur(point.totalProjetEur)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )}

          {/* 6. Scénarios */}
          <Card className="border-border p-6 sm:p-8">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Scénarios travaux
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Le prix d&apos;annonce n&apos;est pas le coût du projet : les travaux peuvent
              dépasser l&apos;hypothèse optimiste.
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
                  <p className="mb-1 text-xs text-muted-foreground">
                    soit {formatEur(scenario.totalProjetEur)}
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{
                        width: `${maxSensitivityTotal > 0 ? (scenario.totalProjetJpy / maxSensitivityTotal) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 7. Forces / vigilances */}
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
                    Avant de considérer cette maison comme une bonne affaire
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

          {/* 8. Confiance */}
          <Card className="border-border p-6 sm:p-8">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Confiance</p>
            <p className={`mb-2 text-lg font-semibold ${CONFIDENCE_STYLES[result.confidence]}`}>
              {OPPORTUNITY_CONFIDENCE_LABELS[result.confidence]}
            </p>
            <p className="text-sm text-muted-foreground">{result.confidenceExplanation}</p>
          </Card>

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
