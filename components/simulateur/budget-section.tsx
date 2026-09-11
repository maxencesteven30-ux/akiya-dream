"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeBudget, computeBudgetVerdict } from "@/lib/calculations";
import { formatEur } from "@/lib/format";
import type { BudgetVerdictLevel, BuyerProfile, RealListing, RenovationLevel } from "@/lib/types";

interface BudgetSectionProps {
  housePriceJpy: number;
  profile: BuyerProfile;
  renovationLevel: RenovationLevel;
  capitalDisponibleEur: number | null;
  onCapitalChange: (value: number | null) => void;
  reserveSecuriteEur: number | null;
  onReserveChange: (value: number | null) => void;
  realListing: RealListing | null;
}

const VERDICT_LABELS: Record<BudgetVerdictLevel, string> = {
  viable: "🟢 Projet viable",
  tendu: "🟠 Projet tendu",
  non_viable: "🔴 Projet non viable",
};

const VERDICT_STYLES: Record<BudgetVerdictLevel, string> = {
  viable: "border-emerald-600/30 bg-emerald-600/5",
  tendu: "border-amber-600/30 bg-amber-600/5",
  non_viable: "border-destructive/30 bg-destructive/5",
};

function parseAmount(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function BudgetSection({
  housePriceJpy,
  profile,
  renovationLevel,
  capitalDisponibleEur,
  onCapitalChange,
  reserveSecuriteEur,
  onReserveChange,
  realListing,
}: BudgetSectionProps) {
  const refinement = useMemo(() => {
    if (!realListing?.constructionYear || !realListing?.surfaceM2) return null;
    return {
      constructionYear: realListing.constructionYear,
      surfaceM2: realListing.surfaceM2,
    };
  }, [realListing]);

  const totalProjetEur = useMemo(
    () => computeBudget(housePriceJpy, profile, renovationLevel, refinement).totalProjetEur,
    [housePriceJpy, profile, renovationLevel, refinement],
  );

  const verdict = useMemo(() => {
    if (capitalDisponibleEur === null || reserveSecuriteEur === null) return null;
    return computeBudgetVerdict(totalProjetEur, capitalDisponibleEur, reserveSecuriteEur);
  }, [totalProjetEur, capitalDisponibleEur, reserveSecuriteEur]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Étape 4 — Votre budget réellement disponible
      </h2>
      <p className="mb-5 text-lg text-foreground">Ce projet est-il à votre portée ?</p>

      <Card className="border-border p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="capital-disponible" className="mb-2 block">
              Capital disponible (EUR)
            </Label>
            <Input
              id="capital-disponible"
              type="number"
              min={0}
              step={1000}
              placeholder="ex. 80000"
              value={capitalDisponibleEur ?? ""}
              onChange={(e) => onCapitalChange(parseAmount(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="reserve-securite" className="mb-2 block">
              Réserve de sécurité souhaitée (EUR)
            </Label>
            <Input
              id="reserve-securite"
              type="number"
              min={0}
              step={1000}
              placeholder="ex. 15000"
              value={reserveSecuriteEur ?? ""}
              onChange={(e) => onReserveChange(parseAmount(e.target.value))}
            />
          </div>
        </div>

        {verdict ? (
          <div className={`mt-6 rounded-md border p-5 ${VERDICT_STYLES[verdict.verdict]}`}>
            <p className="mb-3 font-medium text-foreground">
              {VERDICT_LABELS[verdict.verdict]}
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Budget nécessaire</span>
                <span className="text-foreground">{formatEur(verdict.budgetNecessaireEur)}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Budget disponible</span>
                <span className="text-foreground">{formatEur(verdict.budgetDisponibleEur)}</span>
              </li>
              <li className="flex justify-between border-t border-border pt-1.5 font-medium">
                <span className="text-foreground">
                  {verdict.margeEur >= 0 ? "Marge" : "Manque"}
                </span>
                <span className="text-foreground">
                  {formatEur(Math.abs(verdict.margeEur))}
                </span>
              </li>
            </ul>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Renseignez votre capital et votre réserve de sécurité pour obtenir un verdict.
          </p>
        )}
      </Card>
    </motion.section>
  );
}
