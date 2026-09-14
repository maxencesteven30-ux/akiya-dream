"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { computeHiddenCostsTotal } from "@/lib/calculations";
import { getHiddenCostMidpoint } from "@/lib/hidden-costs";
import { Money } from "@/components/simulateur/money";
import type { HiddenCostsSelection } from "@/lib/types";

interface HiddenCostsSectionProps {
  hiddenCosts: HiddenCostsSelection;
  onHiddenCostsChange: (value: HiddenCostsSelection) => void;
  snowyRegion: boolean;
  onSnowyRegionChange: (value: boolean) => void;
  includeNeighborhoodAssociation: boolean;
  onIncludeNeighborhoodAssociationChange: (value: boolean) => void;
}

const ONE_TIME_OPTIONS: {
  key: keyof HiddenCostsSelection;
  label: string;
  hint: string;
  costId: string;
}[] = [
  {
    key: "surveyBoundary",
    label: "Vérification du bornage géomètre",
    hint: "Recommandé si limites de terrain floues (fréquent en zone rurale)",
    costId: "HC_SURVEY_BOUND",
  },
  {
    key: "pestTreatment",
    label: "Traitement curatif termites / humidité",
    hint: "Si le diagnostic révèle une infestation ou des moisissures",
    costId: "HC_PEST_EXTERMINATE",
  },
  {
    key: "septicTankService",
    label: "Remise en route fosse septique (Jōkasō)",
    hint: "Curage et réactivation si le bien est resté vacant longtemps",
    costId: "HC_SEPTIC_CLEAN",
  },
  {
    key: "backTaxesNegotiation",
    label: "Arriérés de taxes / négociation administrative",
    hint: "Impayés de taxe foncière laissés par l'ancien propriétaire",
    costId: "HC_BACK_TAXES",
  },
];

export function HiddenCostsSection({
  hiddenCosts,
  onHiddenCostsChange,
  snowyRegion,
  onSnowyRegionChange,
  includeNeighborhoodAssociation,
  onIncludeNeighborhoodAssociationChange,
}: HiddenCostsSectionProps) {
  const total = computeHiddenCostsTotal(hiddenCosts);

  const toggle = (key: keyof HiddenCostsSelection, checked: boolean) => {
    onHiddenCostsChange({ ...hiddenCosts, [key]: checked });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        ⚠️ Frais de sécurisation & imprévus terrain
      </h2>
      <p className="mb-5 text-lg text-foreground">
        Configuration avancée des risques contextuels
      </p>

      <Card className="border-border p-0">
        <Accordion>
          <AccordionItem value="hidden-costs">
            <AccordionTrigger className="px-6 sm:px-8">
              Personnaliser les imprévus pris en compte
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 sm:px-8">
              <p className="mb-4 text-xs text-muted-foreground">
                Retours de terrain fréquents chez les acheteurs d&apos;Akiya — cochez ce qui
                s&apos;applique probablement à votre projet. Montants indicatifs (milieu de
                fourchette), pas une donnée mesurée pour ce bien précis.
              </p>

              <div className="space-y-3">
                {ONE_TIME_OPTIONS.map((option) => (
                  <Label
                    key={option.key}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm font-normal transition-colors duration-150 hover:border-primary/40 hover:bg-accent/40"
                  >
                    <Checkbox
                      checked={hiddenCosts[option.key]}
                      onCheckedChange={(checked) => toggle(option.key, checked)}
                      className="mt-0.5"
                    />
                    <span className="flex-1">
                      <span className="block font-medium text-foreground">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      +<Money jpy={getHiddenCostMidpoint(option.costId)} variant="inline" />
                    </span>
                  </Label>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-medium text-foreground">
                  Total imprévus (ponctuel)
                </span>
                <Money jpy={total} className="text-foreground" />
              </div>

              <div className="mt-6 space-y-3 border-t border-border pt-4">
                <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={snowyRegion}
                    onCheckedChange={onSnowyRegionChange}
                  />
                  Région à fortes neiges (ajoute le déneigement au coût annuel)
                </Label>
                <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={includeNeighborhoodAssociation}
                    onCheckedChange={onIncludeNeighborhoodAssociationChange}
                  />
                  Cotisation associative de quartier (Chōnaikai) — quasi systématique
                </Label>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </motion.section>
  );
}
