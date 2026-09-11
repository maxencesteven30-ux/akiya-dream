"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  calculateAnnualCosts,
  computeBudget,
  computeBudgetVerdict,
} from "@/lib/calculations";
import { jpyToEur } from "@/lib/data";
import { formatEur, formatJpy } from "@/lib/format";
import type { BudgetVerdictLevel, SavedProject } from "@/lib/types";

interface ComparateurSectionProps {
  projects: SavedProject[];
  onRemove: (id: string) => void;
  capitalDisponibleEur: number | null;
  reserveSecuriteEur: number | null;
}

const VERDICT_EMOJI: Record<BudgetVerdictLevel, string> = {
  viable: "🟢",
  tendu: "🟠",
  non_viable: "🔴",
};

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
}: ComparateurSectionProps) {
  if (projects.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Étape 5 — Comparer
      </h2>
      <p className="mb-5 text-lg text-foreground">
        {projects.length} projet{projects.length > 1 ? "s" : ""} enregistré
        {projects.length > 1 ? "s" : ""} pour comparaison
      </p>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onRemove={onRemove}
            capitalDisponibleEur={capitalDisponibleEur}
            reserveSecuriteEur={reserveSecuriteEur}
          />
        ))}
      </div>
    </motion.section>
  );
}

function ProjectCard({
  project,
  onRemove,
  capitalDisponibleEur,
  reserveSecuriteEur,
}: {
  project: SavedProject;
  onRemove: (id: string) => void;
  capitalDisponibleEur: number | null;
  reserveSecuriteEur: number | null;
}) {
  const budget = computeBudget(project.housePriceJpy, project.profile, project.renovationLevel);
  const annual = calculateAnnualCosts(project.housePriceJpy, project.profile);
  const verdict =
    capitalDisponibleEur !== null && reserveSecuriteEur !== null
      ? computeBudgetVerdict(budget.totalProjetEur, capitalDisponibleEur, reserveSecuriteEur)
      : null;

  const rows = [
    {
      label: "Prix d'achat",
      value: `${formatJpy(budget.prixAchatJpy)} (${formatEur(jpyToEur(budget.prixAchatJpy))})`,
    },
    {
      label: "Frais d'acquisition",
      value: `${formatJpy(budget.acquisitionFees.total)} (${formatEur(jpyToEur(budget.acquisitionFees.total))})`,
    },
    {
      label: "Travaux",
      value: `${formatJpy(budget.travauxJpy)} (${formatEur(jpyToEur(budget.travauxJpy))})`,
    },
    {
      label: "Coût initial",
      value: `${formatJpy(budget.totalProjetJpy)} (${formatEur(budget.totalProjetEur)})`,
      emphasis: true,
    },
    {
      label: "Coût annuel",
      value: `${formatJpy(annual.totalAnnuelJpy)} (${formatEur(jpyToEur(annual.totalAnnuelJpy))})`,
    },
    {
      label: "Coût à 10 ans",
      value: `${formatJpy(annual.coutDixAnsJpy)} (${formatEur(annual.coutDixAnsEur)})`,
    },
  ];

  return (
    <Card className="w-64 shrink-0 border-border p-5 sm:w-72">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{project.name}</p>
          <p className="text-xs text-muted-foreground">
            {PROFILE_LABELS[project.profile]} · {RENOVATION_LABELS[project.renovationLevel]}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground"
          onClick={() => onRemove(project.id)}
          aria-label={`Retirer ${project.name} du comparateur`}
        >
          ×
        </Button>
      </div>

      <ul className="space-y-1.5 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex flex-col">
            <span className="text-xs text-muted-foreground">{row.label}</span>
            <span className={row.emphasis ? "font-medium text-foreground" : "text-foreground"}>
              {row.value}
            </span>
          </li>
        ))}
      </ul>

      {verdict && (
        <div className="mt-4 border-t border-border pt-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5">
            <span>{VERDICT_EMOJI[verdict.verdict]}</span>
            <span className="text-foreground">
              {verdict.margeEur >= 0 ? "Marge" : "Manque"} :{" "}
              {formatEur(Math.abs(verdict.margeEur))}
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}
