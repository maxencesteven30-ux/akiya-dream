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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { STAGE_LABELS, computeVisitProgress, getItemsByStage } from "@/lib/visit-checklist";
import type { VisitChecklistState, VisitStage } from "@/lib/types";

interface VisitChecklistSectionProps {
  state: VisitChecklistState;
  onChange: (itemId: string, done: boolean) => void;
}

const STAGES: VisitStage[] = ["avant", "pendant", "apres"];

export function VisitChecklistSection({ state, onChange }: VisitChecklistSectionProps) {
  const progress = useMemo(() => computeVisitProgress(state), [state]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          🧳 Checklist de visite
        </h2>
      </div>
      <p className="mb-5 text-lg text-foreground">
        Préparer, dérouler et conclure le déplacement — utilisable hors ligne sur place
      </p>

      <Card className="border-border p-0">
        <Accordion>
          {STAGES.map((stage) => {
            const items = getItemsByStage(stage);
            const stageProgress = progress.find((p) => p.stage === stage)!;
            return (
              <AccordionItem key={stage} value={stage}>
                <AccordionTrigger className="px-6 sm:px-8">
                  <span className="flex-1">
                    {STAGE_LABELS[stage]}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({stageProgress.completed}/{stageProgress.total})
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 sm:px-8">
                  <Progress value={stageProgress.percent} className="mb-4" />
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 text-sm">
                        <Checkbox
                          checked={state[item.id] === true}
                          onCheckedChange={(checked) => onChange(item.id, checked === true)}
                          className="mt-0.5"
                        />
                        <span className="text-foreground">{item.label}</span>
                      </li>
                    ))}
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
