"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RegionCard } from "@/components/simulateur/region-card";
import { computeAccompanimentFee } from "@/lib/calculations";
import { EUR_JPY_RATE, jpyToEur } from "@/lib/data";
import { formatEur, formatJpy } from "@/lib/format";
import type {
  AccompanimentLevel,
  Region,
  RegionAttributeDetail,
  RenovationLevel,
} from "@/lib/types";

export const HOUSE_PRICE_MIN_JPY = 500_000;
export const HOUSE_PRICE_MAX_JPY = 10_000_000;

const RENOVATION_OPTIONS: { value: RenovationLevel; title: string; hint: string }[] = [
  { value: "leger", title: "Léger", hint: "~3 M JPY — rafraîchissement" },
  { value: "standard", title: "Standard", hint: "~8 M JPY — rénovation complète" },
  { value: "lourd", title: "Lourd / Kominka", hint: "~15 M JPY — restauration lourde" },
];

const ACCOMPANIMENT_OPTIONS: { value: AccompanimentLevel; title: string; hint: string }[] = [
  { value: "autonome", title: "Autonome", hint: "Agence standard, aucun accompagnement dédié" },
  {
    value: "curation",
    title: "Service de curation",
    hint: `~${formatJpy(computeAccompanimentFee("curation"))} — sélection de biens vérifiés`,
  },
  {
    value: "cle_en_main",
    title: "Clés en main complet",
    hint: `~${formatJpy(computeAccompanimentFee("cle_en_main"))} — mandatement intégral`,
  },
];

interface ProjetSectionProps {
  regions: Region[];
  regionAttributeDetails: Record<string, RegionAttributeDetail[]>;
  housePriceJpy: number;
  onHousePriceChange: (value: number) => void;
  prefecture: string | null;
  onPrefectureChange: (value: string) => void;
  renovationLevel: RenovationLevel | null;
  onRenovationLevelChange: (value: RenovationLevel) => void;
  accompanimentLevel: AccompanimentLevel;
  onAccompanimentLevelChange: (value: AccompanimentLevel) => void;
  needsTranslation: boolean;
  onNeedsTranslationChange: (value: boolean) => void;
}

export function ProjetSection({
  regions,
  regionAttributeDetails,
  housePriceJpy,
  onHousePriceChange,
  prefecture,
  onPrefectureChange,
  renovationLevel,
  onRenovationLevelChange,
  accompanimentLevel,
  onAccompanimentLevelChange,
  needsTranslation,
  onNeedsTranslationChange,
}: ProjetSectionProps) {
  const [showFiche, setShowFiche] = useState(false);
  const selectedRegion = regions.find((r) => r.prefecture === prefecture) ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div>
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Étape 2 — Votre projet
        </h2>
        <p className="text-lg text-foreground">Décrivez la maison que vous visez</p>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <Label>Prix d&apos;achat affiché</Label>
          <span className="text-right">
            <span className="block text-lg font-semibold text-primary">
              {formatJpy(housePriceJpy)}
            </span>
            <span className="block text-xs text-muted-foreground">
              soit {formatEur(jpyToEur(housePriceJpy))} (1 € ≈ {EUR_JPY_RATE.toFixed(2)} ¥)
            </span>
          </span>
        </div>
        <Slider
          min={HOUSE_PRICE_MIN_JPY}
          max={HOUSE_PRICE_MAX_JPY}
          step={100000}
          value={[housePriceJpy]}
          onValueChange={(v) => onHousePriceChange(Array.isArray(v) ? v[0] : v)}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{formatJpy(HOUSE_PRICE_MIN_JPY)}</span>
          <span>{formatJpy(HOUSE_PRICE_MAX_JPY)}</span>
        </div>
      </div>

      <div>
        <Label className="mb-3 block">Région</Label>
        <Select
          value={prefecture ?? ""}
          onValueChange={(v) => v && onPrefectureChange(v)}
        >
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Choisissez une préfecture" />
          </SelectTrigger>
          <SelectContent>
            {regions.map((region) => (
              <SelectItem key={region.prefecture} value={region.prefecture}>
                {region.prefecture.replace(/_/g, " ")} — niveau {region.recommendationLevel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedRegion && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowFiche((v) => !v)}>
              {showFiche ? "Masquer la fiche" : "Voir la fiche de cette région"}
            </Button>
          </div>
        )}

        {selectedRegion && showFiche && (
          <div className="mt-3">
            <RegionCard
              region={selectedRegion}
              attributeDetails={regionAttributeDetails[selectedRegion.prefecture]}
            />
          </div>
        )}
      </div>

      <div>
        <Label className="mb-3 block">Niveau de travaux</Label>
        <RadioGroup
          value={renovationLevel ?? ""}
          onValueChange={(v) => onRenovationLevelChange(v as RenovationLevel)}
          className="grid gap-3 sm:grid-cols-3 sm:gap-4"
        >
          {RENOVATION_OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`renovation-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 transition-colors duration-150 hover:border-primary/40 hover:bg-accent/40 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
            >
              <RadioGroupItem value={option.value} id={`renovation-${option.value}`} />
              <span>
                <span className="block font-medium text-foreground">{option.title}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div>
        <Label className="mb-3 block">Niveau d&apos;accompagnement souhaité</Label>
        <RadioGroup
          value={accompanimentLevel}
          onValueChange={(v) => onAccompanimentLevelChange(v as AccompanimentLevel)}
          className="grid gap-3 sm:grid-cols-3 sm:gap-4"
        >
          {ACCOMPANIMENT_OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`accompaniment-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 transition-colors duration-150 hover:border-primary/40 hover:bg-accent/40 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
            >
              <RadioGroupItem value={option.value} id={`accompaniment-${option.value}`} />
              <span>
                <span className="block font-medium text-foreground">{option.title}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>

        <Label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={needsTranslation}
            onCheckedChange={(checked) => onNeedsTranslationChange(checked)}
          />
          J&apos;ai besoin d&apos;un traducteur / interprète assermenté
        </Label>
      </div>
    </motion.section>
  );
}
