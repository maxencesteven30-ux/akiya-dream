"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/simulateur/money";
import {
  VISIT_STATUS_LABELS,
  computeDecision,
  computeDocumentsCoverage,
  computeVisitStatus,
  type DecisionLevel,
} from "@/lib/decision-center";
import { buildNextActionSignals } from "@/lib/next-best-action";
import { computeWhatWouldChangeMyMind } from "@/lib/what-would-change-my-mind";
import type { ProjectDocument } from "@/lib/documents";
import type { CompletionSummary } from "@/lib/due-diligence";
import { OPPORTUNITY_CATEGORY_LABELS, FEASIBILITY_LABELS } from "@/lib/opportunity";
import type { FeasibilityLevel, OpportunityCategory } from "@/lib/opportunity";
import { computeRiskLevel, RISK_LEVEL_LABELS } from "@/lib/project-score";
import { computeVisitProgress } from "@/lib/visit-checklist";
import { CHECKLIST_TEMPLATE } from "@/lib/due-diligence";
import {
  LAND_NATURE_LABELS,
  REALITY_GATE_TEMPLATE,
  computeRealityGate,
  getRealityGateMessage,
} from "@/lib/reality-gate";
import type { RiskFlag } from "@/lib/calculations";
import type { DueDiligenceState, LandNature, RealityGateState, VisitChecklistState } from "@/lib/types";

interface DecisionCenterSectionProps {
  propertyName: string;
  opportunityScore: number;
  opportunityCategory: OpportunityCategory;
  feasibility: FeasibilityLevel | null;
  riskFlags: RiskFlag[];
  budgetTotalJpy: number;
  dueDiligence: DueDiligenceState;
  completion: CompletionSummary;
  visitChecklist: VisitChecklistState;
  realityGate: RealityGateState;
  landNature: LandNature | null;
  // null tant que le projet n'a pas été sauvegardé (Phase O) : les pièces
  // ne peuvent pas exister sans id de projet, ce n'est pas une estimation
  // à 0, juste une donnée indisponible pour l'instant.
  documents: ProjectDocument[] | null;
}

const RANK_MEDALS: Record<1 | 2 | 3, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const DECISION_STYLES: Record<DecisionLevel, string> = {
  pret: "border-emerald-600/40 bg-emerald-600/10",
  verifications: "border-amber-600/30 bg-amber-600/5",
  bloque: "border-destructive/30 bg-destructive/5",
};

export function DecisionCenterSection({
  propertyName,
  opportunityScore,
  opportunityCategory,
  feasibility,
  riskFlags,
  budgetTotalJpy,
  dueDiligence,
  completion,
  visitChecklist,
  realityGate,
  landNature,
  documents,
}: DecisionCenterSectionProps) {
  const visitStatus = computeVisitStatus(computeVisitProgress(visitChecklist));
  const risk = computeRiskLevel({ hasProblem: completion.hasProblem, feasibility, riskFlags });
  const realityGateResult = computeRealityGate(realityGate, landNature);
  const decision = computeDecision({
    realityGateLevel: realityGateResult.level,
    hasProblem: completion.hasProblem,
    feasibility,
    completion,
    visitStatus,
  });
  const dueDiligenceBlockers = CHECKLIST_TEMPLATE.filter((item) => dueDiligence[item.id] === "probleme");
  const realityGateBlockers = REALITY_GATE_TEMPLATE.filter((item) => realityGate[item.id] === "probleme");
  const documentsCoverage = documents ? computeDocumentsCoverage(documents) : null;
  const nextActionSignals = buildNextActionSignals({
    realityGate,
    landNature,
    dueDiligence,
    completion,
    feasibility,
    visitStatus,
    documentsCount: documentsCoverage?.documentsCount ?? 0,
  });
  const [nextAction] = nextActionSignals;
  const mindChangingFactors = computeWhatWouldChangeMyMind(nextActionSignals);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          🏠 Centre de décision
        </h2>
      </div>
      <p className="mb-5 text-lg text-foreground">{propertyName}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <p className="mt-1 text-xs text-muted-foreground">
            Budget projet (estimation) :{" "}
            <Money jpy={budgetTotalJpy} variant="inline" className="text-muted-foreground" />
          </p>
        </Card>

        <Card className="border-border p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">⚠️ Risque</p>
          <p className="mt-2 text-sm font-medium text-foreground">{RISK_LEVEL_LABELS[risk]}</p>
          {riskFlags.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {riskFlags.length} point{riskFlags.length > 1 ? "s" : ""} de vigilance
            </p>
          )}
        </Card>

        <Card className="border-border p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">📋 Due diligence</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {completion.completed}
            <span className="text-sm font-normal text-muted-foreground"> / {completion.total}</span>
          </p>
        </Card>

        <Card className="border-border p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">📎 Documents</p>
          {documentsCoverage ? (
            <>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {documentsCoverage.coveredCategories}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / {documentsCoverage.totalCategories} types
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {documentsCoverage.documentsCount} pièce{documentsCoverage.documentsCount > 1 ? "s" : ""}{" "}
                ajoutée{documentsCoverage.documentsCount > 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Non disponible — sauvegardez le projet pour suivre vos pièces.
            </p>
          )}
        </Card>

        <Card className="border-border p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">🗓️ Visite</p>
          <p className="mt-2 text-sm font-medium text-foreground">{VISIT_STATUS_LABELS[visitStatus]}</p>
        </Card>

        <Card className="border-border p-5 sm:col-span-2 lg:col-span-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            🏗️ Reality Gate — ce bien est-il réellement achetable et exploitable ?
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {getRealityGateMessage(realityGateResult)}
          </p>
          {landNature && (
            <p className="mt-1 text-xs text-muted-foreground">{LAND_NATURE_LABELS[landNature]}</p>
          )}
        </Card>
      </div>

      <Card className={`mt-4 border p-6 ${DECISION_STYLES[decision.level]}`}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Décision actuelle
        </p>
        <p className="mt-1 text-lg font-medium text-foreground">{decision.label}</p>

        {(realityGateBlockers.length > 0 || landNature === "agricole" || dueDiligenceBlockers.length > 0) && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Blocages restants
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-foreground">
              {landNature === "agricole" && <li>• Terrain agricole soumis à restrictions</li>}
              {realityGateBlockers.map((item) => (
                <li key={item.id}>• {item.label}</li>
              ))}
              {dueDiligenceBlockers.map((item) => (
                <li key={item.id}>• {item.label}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Prochaine action
          </p>
          <p className="mt-1 text-sm text-foreground">
            {nextAction?.message ?? "Projet prêt pour une offre."}
          </p>
        </div>

        {mindChangingFactors.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              🔮 Ce qui pourrait changer le verdict
            </p>
            <ul className="mt-1.5 space-y-2 text-sm text-foreground">
              {mindChangingFactors.map((factor) => (
                <li key={factor.rank}>
                  <span aria-hidden>{RANK_MEDALS[factor.rank]}</span> {factor.action}
                  <span className="mt-0.5 block text-xs text-muted-foreground">{factor.why}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </motion.section>
  );
}
