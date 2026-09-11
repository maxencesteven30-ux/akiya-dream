"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/simulateur/money";
import { calculateAnnualCosts, computeBudget } from "@/lib/calculations";
import { computeCostProjection } from "@/lib/taxes";
import type {
  AccompanimentLevel,
  BuyerProfile,
  HiddenCostsSelection,
  RealListing,
  RenovationLevel,
} from "@/lib/types";

interface TaxProjectionSectionProps {
  housePriceJpy: number;
  profile: BuyerProfile;
  renovationLevel: RenovationLevel;
  realListing: RealListing | null;
  accompanimentLevel: AccompanimentLevel;
  needsTranslation: boolean;
  hiddenCosts: HiddenCostsSelection;
  snowyRegion: boolean;
  includeNeighborhoodAssociation: boolean;
}

export function TaxProjectionSection({
  housePriceJpy,
  profile,
  renovationLevel,
  realListing,
  accompanimentLevel,
  needsTranslation,
  hiddenCosts,
  snowyRegion,
  includeNeighborhoodAssociation,
}: TaxProjectionSectionProps) {
  const refinement = useMemo(() => {
    if (!realListing?.constructionYear || !realListing?.surfaceM2) return null;
    return {
      constructionYear: realListing.constructionYear,
      surfaceM2: realListing.surfaceM2,
    };
  }, [realListing]);

  const budget = useMemo(
    () =>
      computeBudget(
        housePriceJpy,
        profile,
        renovationLevel,
        refinement,
        accompanimentLevel,
        needsTranslation,
        hiddenCosts,
      ),
    [housePriceJpy, profile, renovationLevel, refinement, accompanimentLevel, needsTranslation, hiddenCosts],
  );

  const annualCosts = useMemo(
    () =>
      calculateAnnualCosts(housePriceJpy, profile, includeNeighborhoodAssociation, snowyRegion),
    [housePriceJpy, profile, includeNeighborhoodAssociation, snowyRegion],
  );

  const projection = useMemo(
    () => computeCostProjection(budget.totalProjetJpy, annualCosts.totalAnnuelJpy),
    [budget.totalProjetJpy, annualCosts.totalAnnuelJpy],
  );

  const maxCost = Math.max(...projection.map((p) => p.cumulativeCostJpy));

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        📈 Projection 10 ans
      </h2>
      <p className="mb-5 text-lg text-foreground">
        De l&apos;achat aux charges cumulées sur la durée
      </p>

      <Card className="border-border p-6 sm:p-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Coût cumulé (achat + travaux + charges annuelles répétées)
        </p>
        <div className="space-y-3">
          {projection.map((point) => (
            <div key={point.year} className="flex items-center gap-3 text-sm">
              <span className="w-16 shrink-0 text-muted-foreground">
                Année {point.year}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${maxCost > 0 ? (point.cumulativeCostJpy / maxCost) * 100 : 0}%`,
                  }}
                />
              </div>
              <Money jpy={point.cumulativeCostJpy} className="w-32 shrink-0 text-right text-foreground" />
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Taxes calculées aux taux nationaux standards japonais (1,4% taxe foncière + 0,3% taxe
          d&apos;urbanisme) — une règle uniforme, pas une donnée vérifiée municipalité par
          municipalité.
        </p>

        <p className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Les travaux de rénovation peuvent être déductibles des revenus locatifs ou ouvrir droit
          à un crédit d&apos;impôt selon des conditions fixées par l&apos;administration fiscale
          japonaise (certification, exercice fiscal en cours...). Ces seuils varient et ne sont
          pas calculés ici — consultez un comptable (Zeirishi) pour évaluer votre situation
          précise.
        </p>
      </Card>
    </motion.section>
  );
}
