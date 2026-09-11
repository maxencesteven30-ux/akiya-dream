"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/simulateur/money";
import { computeTotalSubsidies, getEligibleSubsidies } from "@/lib/subsidies";
import type { Subsidy } from "@/lib/types";

interface SubsidiesSectionProps {
  prefecture: string | null;
  onTotalChange?: (totalJpy: number) => void;
  onEligibleChange?: (subsidies: Subsidy[]) => void;
}

export function SubsidiesSection({
  prefecture,
  onTotalChange,
  onEligibleChange,
}: SubsidiesSectionProps) {
  const [residenceCommitment, setResidenceCommitment] = useState(false);
  const [usesAkiyaBank, setUsesAkiyaBank] = useState(false);

  const eligible = useMemo(() => {
    if (!prefecture) return [];
    return getEligibleSubsidies(prefecture, {
      residenceCommitment,
      usesAkiyaBank,
      hasLocalContractor: true,
    });
  }, [prefecture, residenceCommitment, usesAkiyaBank]);

  const total = useMemo(() => computeTotalSubsidies(eligible), [eligible]);

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  useEffect(() => {
    onEligibleChange?.(eligible);
  }, [eligible, onEligibleChange]);

  if (!prefecture) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        💰 Aides disponibles
      </h2>
      <p className="mb-5 text-lg text-foreground">
        Subventions municipales et nationales potentiellement applicables
      </p>

      <Card className="border-border p-6 sm:p-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:gap-6">
          <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={residenceCommitment}
              onCheckedChange={(checked) => setResidenceCommitment(checked)}
            />
            Je m&apos;engage à résider 5+ ans
          </Label>
          <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={usesAkiyaBank}
              onCheckedChange={(checked) => setUsesAkiyaBank(checked === true)}
            />
            Je passe par une akiya bank
          </Label>
        </div>

        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun programme sourcé disponible pour {prefecture.replace(/_/g, " ")} avec ces
            critères pour le moment.
          </p>
        ) : (
          <ul className="space-y-4">
            {eligible.map((subsidy) => (
              <li key={subsidy.id} className="rounded-md border border-border p-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-foreground">{subsidy.name}</p>
                  <Money jpy={subsidy.maxAmountJpy} className="text-foreground" />
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  {subsidy.municipality}
                  {subsidy.coveragePercent !== null ? ` · ${subsidy.coveragePercent}% couvert` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {subsidy.conditions.map((condition, i) => (
                    <Badge key={i} variant="outline" className="font-normal">
                      {condition}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm font-medium text-foreground">Total des aides</span>
          <Money jpy={total} className="text-lg font-semibold text-foreground" />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          ⚠️ Demandez ces aides AVANT le début des travaux — la plupart des programmes ne sont
          pas rétroactifs. Vérifiez les conditions exactes et la disponibilité budgétaire auprès
          de la municipalité avant toute décision.
        </p>
      </Card>
    </motion.section>
  );
}
