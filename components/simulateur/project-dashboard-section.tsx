"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import type { CompletionSummary } from "@/lib/due-diligence";
import { OPPORTUNITY_CATEGORY_LABELS, FEASIBILITY_LABELS } from "@/lib/opportunity";
import type { FeasibilityLevel, OpportunityCategory } from "@/lib/opportunity";
import { computeProjectVerdict, computeRiskLevel, RISK_LEVEL_LABELS } from "@/lib/project-score";
import type { RiskFlag } from "@/lib/calculations";

interface ProjectDashboardSectionProps {
  opportunityScore: number;
  opportunityCategory: OpportunityCategory;
  feasibility: FeasibilityLevel | null;
  riskFlags: RiskFlag[];
  completion: CompletionSummary;
}

const VERDICT_STYLES: Record<string, string> = {
  vert: "border-emerald-600/40 bg-emerald-600/10",
  jaune: "border-amber-500/30 bg-amber-500/5",
  orange: "border-amber-600/30 bg-amber-600/5",
  rouge: "border-destructive/30 bg-destructive/5",
};

export function ProjectDashboardSection({
  opportunityScore,
  opportunityCategory,
  feasibility,
  riskFlags,
  completion,
}: ProjectDashboardSectionProps) {
  const risk = computeRiskLevel({ hasProblem: completion.hasProblem, feasibility, riskFlags });
  const verdict = computeProjectVerdict({ opportunityCategory, risk, completion });

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          📋 Score global du projet
        </h2>
      </div>
      <p className="mb-5 text-lg text-foreground">Vue d&apos;ensemble en 4 dimensions</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">🏠 Opportunité</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {opportunityScore.toFixed(1)}
            <span className="text-sm font-normal text-muted-foreground"> / 10</span>
          </p>
          <p className="mt-1 text-sm text-foreground">{OPPORTUNITY_CATEGORY_LABELS[opportunityCategory]}</p>
        </Card>

        <Card className="border-border p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">💰 Faisabilité</p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {feasibility ? FEASIBILITY_LABELS[feasibility] : "Budget non renseigné"}
          </p>
        </Card>

        <Card className="border-border p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">⚠️ Risque</p>
          <p className="mt-2 text-sm font-medium text-foreground">{RISK_LEVEL_LABELS[risk]}</p>
        </Card>

        <Card className="border-border p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">📋 Complétude</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {completion.percent}
            <span className="text-sm font-normal text-muted-foreground">%</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {completion.completed} / {completion.total} éléments traités
          </p>
        </Card>
      </div>

      <Card className={`mt-4 border p-6 ${VERDICT_STYLES[verdict.level]}`}>
        <p className="text-base font-medium text-foreground">{verdict.message}</p>
      </Card>
    </motion.section>
  );
}
