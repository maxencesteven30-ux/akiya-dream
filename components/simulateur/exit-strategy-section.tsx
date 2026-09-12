"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/simulateur/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXIT_STRATEGY_LABELS,
  HORIZON_OPTIONS,
  MINPAKU_180_DAYS_DISCLAIMER,
  MINPAKU_CHECKLIST_TEMPLATE,
  RENTAL_FISCALITY_DISCLAIMER,
  computeDemolitionComparison,
  computeMinpakuChecklistSummary,
  computeRentalSimulation,
  computeResaleSimulation,
} from "@/lib/exit-strategy";
import type { ExitStrategy, ExitStrategyProfile, ProjectionHorizonYears } from "@/lib/types";

interface ExitStrategySectionProps {
  profile: ExitStrategyProfile;
  onChange: <K extends keyof ExitStrategyProfile>(key: K, value: ExitStrategyProfile[K]) => void;
  onMinpakuItemChange: (itemId: string, done: boolean) => void;
  prixAchatJpy: number;
  capitalInvestiJpy: number;
  totalAnnuelJpy: number;
  travauxJpy: number;
}

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function ExitStrategySection({
  profile,
  onChange,
  onMinpakuItemChange,
  prixAchatJpy,
  capitalInvestiJpy,
  totalAnnuelJpy,
  travauxJpy,
}: ExitStrategySectionProps) {
  const resaleSimulation = useMemo(
    () =>
      profile.resaleValueJpy !== null
        ? computeResaleSimulation({
            capitalInvestiJpy,
            totalAnnuelJpy,
            horizonYears: profile.horizonYears,
            resaleValueJpy: profile.resaleValueJpy,
          })
        : null,
    [profile.resaleValueJpy, profile.horizonYears, capitalInvestiJpy, totalAnnuelJpy],
  );

  const rentalSimulation = useMemo(
    () =>
      profile.monthlyRentJpy !== null && profile.occupancyRatePercent !== null
        ? computeRentalSimulation({
            prixAchatJpy,
            monthlyRentJpy: profile.monthlyRentJpy,
            occupancyRatePercent: profile.occupancyRatePercent,
            totalAnnuelJpy,
          })
        : null,
    [profile.monthlyRentJpy, profile.occupancyRatePercent, prixAchatJpy, totalAnnuelJpy],
  );

  const minpakuSummary = useMemo(
    () => computeMinpakuChecklistSummary(profile.minpakuChecklist),
    [profile.minpakuChecklist],
  );

  const demolitionComparison =
    profile.demolitionCostJpy !== null
      ? computeDemolitionComparison(travauxJpy, profile.demolitionCostJpy)
      : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        🔄 Exit Strategy
      </h2>
      <p className="mb-5 text-lg text-foreground">Et si dans 10 ans je veux partir ?</p>

      <Card className="border-border p-6 sm:p-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Quelle stratégie envisages-tu ?
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(EXIT_STRATEGY_LABELS) as ExitStrategy[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange("strategy", option)}
              className={`rounded-md border p-3 text-left text-sm transition-colors ${
                profile.strategy === option
                  ? "border-primary/40 bg-accent/30"
                  : "border-border hover:border-primary/30"
              }`}
            >
              {EXIT_STRATEGY_LABELS[option]}
            </button>
          ))}
        </div>
      </Card>

      {(profile.strategy === "revendre" || profile.strategy === "garder") && (
        <Card className="mt-4 border-border p-6 sm:p-8">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            📈 Simulation de revente (hypothèse, pas une prédiction)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-sm">Horizon</Label>
              <Select
                value={String(profile.horizonYears)}
                onValueChange={(v) => v && onChange("horizonYears", Number(v) as ProjectionHorizonYears)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => `${value} ans`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {HORIZON_OPTIONS.map((years) => (
                    <SelectItem key={years} value={String(years)}>
                      {years} ans
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Valeur de revente hypothétique (JPY)</Label>
              <Input
                type="number"
                value={profile.resaleValueJpy ?? ""}
                onChange={(e) => onChange("resaleValueJpy", parseNumber(e.target.value))}
                placeholder="ex. 3000000"
              />
            </div>
          </div>

          {resaleSimulation ? (
            <ul className="mt-4 space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Capital investi</span>
                <Money jpy={resaleSimulation.capitalInvestiJpy} className="text-foreground" />
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Frais cumulés ({profile.horizonYears} ans)</span>
                <Money jpy={resaleSimulation.fraisCumulesJpy} className="text-foreground" />
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Frais de sortie (agence)</span>
                <Money jpy={resaleSimulation.fraisSortieJpy} className="text-foreground" />
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Produit de vente net</span>
                <Money jpy={resaleSimulation.produitVenteJpy} className="text-foreground" />
              </li>
              <li className="flex justify-between border-t border-border pt-1.5 font-medium">
                <span className="text-foreground">
                  {resaleSimulation.coutNetJpy >= 0 ? "Coût net sur la période" : "Gain net sur la période"}
                </span>
                <Money jpy={Math.abs(resaleSimulation.coutNetJpy)} className="text-foreground" />
              </li>
            </ul>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Renseigne une valeur de revente hypothétique pour voir la simulation.
            </p>
          )}
        </Card>
      )}

      {profile.strategy === "louer" && (
        <Card className="mt-4 border-border p-6 sm:p-8">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            🏠 Simulation de location longue durée (hypothèse)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-sm">Loyer mensuel hypothétique (JPY)</Label>
              <Input
                type="number"
                value={profile.monthlyRentJpy ?? ""}
                onChange={(e) => onChange("monthlyRentJpy", parseNumber(e.target.value))}
                placeholder="ex. 50000"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Taux d&apos;occupation hypothétique (%)</Label>
              <Input
                type="number"
                value={profile.occupancyRatePercent ?? ""}
                onChange={(e) => onChange("occupancyRatePercent", parseNumber(e.target.value))}
                placeholder="ex. 80"
              />
            </div>
          </div>

          {rentalSimulation ? (
            <ul className="mt-4 space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Revenu annuel brut</span>
                <Money jpy={rentalSimulation.revenuAnnuelBrutJpy} className="text-foreground" />
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Rendement brut</span>
                <span className="text-foreground">{rentalSimulation.rendementBrutPercent.toFixed(1)}%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Coûts annuels (charges de possession)</span>
                <Money jpy={rentalSimulation.coutsAnnuelsJpy} className="text-foreground" />
              </li>
              <li className="flex justify-between border-t border-border pt-1.5 font-medium">
                <span className="text-foreground">Cash-flow estimé (avant impôt)</span>
                <Money jpy={Math.abs(rentalSimulation.cashFlowEstimeJpy)} className="text-foreground" />
              </li>
            </ul>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Renseigne un loyer et un taux d&apos;occupation hypothétiques pour voir la simulation.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">⚠️ {RENTAL_FISCALITY_DISCLAIMER}</p>
        </Card>
      )}

      {profile.strategy === "minpaku" && (
        <Card className="mt-4 border-border p-6 sm:p-8">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              🏨 Mon projet peut-il envisager du minpaku ?
            </p>
            <span className="text-sm font-medium text-foreground">
              {minpakuSummary.completed} / {minpakuSummary.total}
            </span>
          </div>
          <ul className="space-y-2">
            {MINPAKU_CHECKLIST_TEMPLATE.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={profile.minpakuChecklist[item.id] === true}
                  onCheckedChange={(checked) => onMinpakuItemChange(item.id, checked === true)}
                />
                <span className="text-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">{MINPAKU_180_DAYS_DISCLAIMER}</p>
        </Card>
      )}

      {profile.strategy === "demolir" && (
        <Card className="mt-4 border-border p-6 sm:p-8">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            🏚️ Rénover ou 💥 démolir ?
          </p>
          <div>
            <Label className="mb-1.5 block text-sm">Coût de démolition estimé (devis ou hypothèse, JPY)</Label>
            <Input
              type="number"
              value={profile.demolitionCostJpy ?? ""}
              onChange={(e) => onChange("demolitionCostJpy", parseNumber(e.target.value))}
              placeholder="ex. 2000000"
              className="w-full sm:w-64"
            />
          </div>

          {demolitionComparison && (
            <ul className="mt-4 space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Rénover (travaux estimés)</span>
                <Money jpy={demolitionComparison.renovationJpy} className="text-foreground" />
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Démolir (devis/hypothèse)</span>
                <Money jpy={demolitionComparison.demolitionJpy} className="text-foreground" />
              </li>
              <li className="flex justify-between border-t border-border pt-1.5 font-medium">
                <span className="text-foreground">
                  {demolitionComparison.deltaJpy >= 0 ? "La démolition coûte plus" : "La démolition coûte moins"}
                </span>
                <Money jpy={Math.abs(demolitionComparison.deltaJpy)} className="text-foreground" />
              </li>
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            ⚠️ Cette comparaison ne présume pas qu&apos;une reconstruction sera possible après démolition —
            vérifie le droit à reconstruire dans le Property Reality Gate avant toute décision.
          </p>
        </Card>
      )}
    </motion.section>
  );
}
