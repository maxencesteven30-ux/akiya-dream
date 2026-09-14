"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORY_LABELS,
  DUE_DILIGENCE_VERDICT_LABELS,
  STATUS_LABELS,
  computeCompletionSummary,
  computeDueDiligenceVerdict,
  getItemsByCategory,
} from "@/lib/due-diligence";
import type { ChecklistCategory, ChecklistStatus, DueDiligenceState } from "@/lib/types";

interface DueDiligenceSectionProps {
  state: DueDiligenceState;
  onChange: (itemId: string, status: ChecklistStatus) => void;
}

const CATEGORIES: ChecklistCategory[] = ["batiment", "juridique", "terrain", "vie_locale"];

const STATUS_OPTIONS: ChecklistStatus[] = [
  "a_verifier",
  "verifie",
  "probleme",
  "non_applicable",
];

const VERDICT_STYLES = {
  documente: "border-emerald-600/30 bg-emerald-600/5",
  incomplet: "border-amber-600/30 bg-amber-600/5",
  deconseille: "border-destructive/30 bg-destructive/5",
} as const;

export function DueDiligenceSection({ state, onChange }: DueDiligenceSectionProps) {
  const summary = useMemo(() => computeCompletionSummary(state), [state]);
  const verdict = useMemo(() => computeDueDiligenceVerdict(summary), [summary]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        🔍 Dossier de vérification (due diligence)
      </h2>
      <p className="mb-5 text-lg text-foreground">
        De &quot;ça semble être une bonne affaire&quot; à &quot;voici ce qu&apos;il faut vérifier&quot;
      </p>

      <Card className={`border p-6 sm:p-8 ${VERDICT_STYLES[verdict]}`}>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-medium text-foreground">
            Score de complétude du dossier
          </span>
          <span className="text-lg font-semibold text-foreground">
            {summary.completed} / {summary.total}
          </span>
        </div>
        <Progress value={summary.percent} />
        <p className="mt-4 text-base font-medium text-foreground">
          {DUE_DILIGENCE_VERDICT_LABELS[verdict]}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Un feu de signalisation documentaire — pas une décision juridique. Vérifie chaque
          élément avec un professionnel avant toute offre.
        </p>
      </Card>

      <Card className="mt-4 border-border p-0">
        <Accordion>
          {CATEGORIES.map((category) => {
            const items = getItemsByCategory(category);
            const categoryCompleted = items.filter(
              (item) => (state[item.id] ?? "a_verifier") !== "a_verifier",
            ).length;
            return (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="px-6 sm:px-8">
                  <span>
                    {CATEGORY_LABELS[category]}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({categoryCompleted}/{items.length})
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 sm:px-8">
                  <ul className="space-y-2">
                    {items.map((item) => {
                      const status = state[item.id] ?? "a_verifier";
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5 text-sm"
                        >
                          <span className="text-foreground">{item.label}</span>
                          <Select
                            value={status}
                            onValueChange={(v) => v && onChange(item.id, v as ChecklistStatus)}
                          >
                            <SelectTrigger className="w-44 shrink-0" aria-label={item.label}>
                              <SelectValue>
                                {(value: ChecklistStatus) => STATUS_LABELS[value] ?? value}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {STATUS_LABELS[option]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </Card>
    </motion.section>
  );
}
