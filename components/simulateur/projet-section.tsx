"use client";

import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatJpy } from "@/lib/format";
import type { Region, RenovationLevel } from "@/lib/types";

export const HOUSE_PRICE_MIN_JPY = 500_000;
export const HOUSE_PRICE_MAX_JPY = 10_000_000;

const RENOVATION_OPTIONS: { value: RenovationLevel; title: string; hint: string }[] = [
  { value: "leger", title: "Léger", hint: "~3 M JPY — rafraîchissement" },
  { value: "standard", title: "Standard", hint: "~8 M JPY — rénovation complète" },
  { value: "lourd", title: "Lourd / Kominka", hint: "~15 M JPY — restauration lourde" },
];

interface ProjetSectionProps {
  regions: Region[];
  housePriceJpy: number;
  onHousePriceChange: (value: number) => void;
  prefecture: string | null;
  onPrefectureChange: (value: string) => void;
  renovationLevel: RenovationLevel | null;
  onRenovationLevelChange: (value: RenovationLevel) => void;
}

export function ProjetSection({
  regions,
  housePriceJpy,
  onHousePriceChange,
  prefecture,
  onPrefectureChange,
  renovationLevel,
  onRenovationLevelChange,
}: ProjetSectionProps) {
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
          <span className="text-lg font-semibold text-primary">
            {formatJpy(housePriceJpy)}
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
    </motion.section>
  );
}
