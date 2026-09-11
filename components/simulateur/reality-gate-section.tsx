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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORY_LABELS,
  LAND_NATURE_LABELS,
  REALITY_GATE_DOCUMENTS_TEMPLATE,
  REALITY_GATE_STATUS_LABELS,
  computeDocumentsAvailability,
  computeRealityGate,
  getItemsByCategory,
  getRealityGateMessage,
} from "@/lib/reality-gate";
import type {
  LandNature,
  RealityGateDocumentsState,
  RealityGateItemStatus,
  RealityGateState,
} from "@/lib/types";

interface RealityGateSectionProps {
  state: RealityGateState;
  onChange: (itemId: string, status: RealityGateItemStatus) => void;
  landNature: LandNature | null;
  onLandNatureChange: (nature: LandNature | null) => void;
  documents: RealityGateDocumentsState;
  onDocumentsChange: (docId: string, available: boolean) => void;
}

// Sentinelle UI pour "non renseigné" : le Select doit toujours recevoir
// une valeur définie (jamais undefined) pour rester un composant
// contrôlé dès le premier rendu — landNature (typé LandNature | null)
// reste, lui, le seul état de vérité.
const NOT_SET = "non_renseigne";

const CATEGORIES: Array<"acces" | "reconstruction" | "reseaux"> = [
  "acces",
  "reconstruction",
  "reseaux",
];

const STATUS_OPTIONS: RealityGateItemStatus[] = ["verifie", "a_confirmer", "probleme"];

const LAND_NATURE_OPTIONS: LandNature[] = ["residentiel", "forestier", "agricole"];

const RESULT_STYLES: Record<"vert" | "orange" | "rouge", string> = {
  vert: "border-emerald-600/30 bg-emerald-600/5",
  orange: "border-amber-600/30 bg-amber-600/5",
  rouge: "border-destructive/30 bg-destructive/5",
};

export function RealityGateSection({
  state,
  onChange,
  landNature,
  onLandNatureChange,
  documents,
  onDocumentsChange,
}: RealityGateSectionProps) {
  const result = useMemo(() => computeRealityGate(state, landNature), [state, landNature]);
  const documentsAvailability = useMemo(() => computeDocumentsAvailability(documents), [documents]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        🏗️ Property Reality Gate
      </h2>
      <p className="mb-5 text-lg text-foreground">Ce bien est-il réellement achetable et exploitable ?</p>

      <Card className={`border p-6 sm:p-8 ${RESULT_STYLES[result.level]}`}>
        <p className="text-base font-medium text-foreground">{getRealityGateMessage(result)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Une checklist déclarative — jamais une conclusion automatique. Chaque point reste à
          vérifier auprès de la mairie, d&apos;un shihō shoshi ou d&apos;un professionnel avant
          toute offre.
        </p>
      </Card>

      <Card className="mt-4 border-border p-0">
        <Accordion>
          {CATEGORIES.map((category) => {
            const items = getItemsByCategory(category);
            const verifiedCount = items.filter((item) => state[item.id] === "verifie").length;
            return (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="px-6 sm:px-8">
                  <span>
                    {CATEGORY_LABELS[category]}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({verifiedCount}/{items.length} vérifiés)
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 sm:px-8">
                  <ul className="space-y-2">
                    {items.map((item) => {
                      const status = state[item.id] ?? "a_confirmer";
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5 text-sm"
                        >
                          <span className="text-foreground">{item.label}</span>
                          <Select
                            value={status}
                            onValueChange={(v) => v && onChange(item.id, v as RealityGateItemStatus)}
                          >
                            <SelectTrigger className="w-56 shrink-0">
                              <SelectValue>
                                {(value: RealityGateItemStatus) =>
                                  REALITY_GATE_STATUS_LABELS[value] ?? value
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {REALITY_GATE_STATUS_LABELS[option]}
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

      <Card className="mt-4 border-border p-6 sm:p-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          🌾 Nature juridique du terrain
        </p>
        <Select
          value={landNature ?? NOT_SET}
          onValueChange={(v) => {
            if (!v) return;
            onLandNatureChange(v === NOT_SET ? null : (v as LandNature));
          }}
        >
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue>
              {(value: LandNature | typeof NOT_SET) =>
                value === NOT_SET ? "Non renseigné" : (LAND_NATURE_LABELS[value] ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOT_SET}>Non renseigné</SelectItem>
            {LAND_NATURE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {LAND_NATURE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-3 text-xs text-muted-foreground">
          Un terrain agricole (nōchi) reste soumis à l&apos;autorisation de la commission agricole
          (nōgyō iinkai), rarement accordée à un acquéreur résidant à l&apos;étranger. Un terrain
          forestier impose une déclaration à la mairie dans les 90 jours suivant l&apos;acquisition.
        </p>
      </Card>

      <Card className="mt-4 border-border p-6 sm:p-8">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            📑 Documents officiels disponibles
          </p>
          <span className="text-sm font-medium text-foreground">
            {documentsAvailability.available} / {documentsAvailability.total}
          </span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {REALITY_GATE_DOCUMENTS_TEMPLATE.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={documents[doc.id] === true}
                onCheckedChange={(checked) => onDocumentsChange(doc.id, checked === true)}
              />
              <span className="text-foreground">{doc.label}</span>
            </li>
          ))}
        </ul>
      </Card>
    </motion.section>
  );
}
