"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { scoreAllRegions } from "@/lib/scoring";
import type { PreferenceChoice, RegionScore, SnowPreference } from "@/lib/scoring";
import type { Region, RegionAttributes } from "@/lib/types";

interface RegionFinderProps {
  regions: Region[];
  regionAttributes: Record<string, RegionAttributes>;
  capitalDisponibleEur: number | null;
  reserveSecuriteEur: number | null;
  onSelectRegion: (prefecture: string) => void;
}

const BINARY_OPTIONS: { value: PreferenceChoice; label: string }[] = [
  { value: "importe", label: "Oui" },
  { value: "peu_importe", label: "Peu importe" },
];

const SNOW_OPTIONS: { value: SnowPreference; label: string }[] = [
  { value: "eviter", label: "Éviter la neige" },
  { value: "peu_importe", label: "Peu importe" },
  { value: "recherche", label: "Je recherche la neige" },
];

export function RegionFinder({
  regions,
  regionAttributes,
  capitalDisponibleEur,
  reserveSecuriteEur,
  onSelectRegion,
}: RegionFinderProps) {
  const [open, setOpen] = useState(false);
  const [coastal, setCoastal] = useState<PreferenceChoice>("peu_importe");
  const [shinkansen, setShinkansen] = useState<PreferenceChoice>("peu_importe");
  const [rural, setRural] = useState<PreferenceChoice>("peu_importe");
  const [snow, setSnow] = useState<SnowPreference>("peu_importe");

  const hasBudget = capitalDisponibleEur !== null && reserveSecuriteEur !== null;

  const scores = useMemo(() => {
    const budget = hasBudget ? { capitalDisponibleEur: capitalDisponibleEur!, reserveSecuriteEur: reserveSecuriteEur! } : null;
    return scoreAllRegions(regions, regionAttributes, { coastal, shinkansen, rural, snow, budget });
  }, [regions, regionAttributes, coastal, shinkansen, rural, snow, hasBudget, capitalDisponibleEur, reserveSecuriteEur]);

  const budget = hasBudget
    ? { capitalDisponibleEur: capitalDisponibleEur!, reserveSecuriteEur: reserveSecuriteEur! }
    : null;

  const hasAnyPreference =
    coastal === "importe" || shinkansen === "importe" || rural === "importe" || snow !== "peu_importe" || budget !== null;

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Pas sûr de la région ? Trouver ma région
        </Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-border p-6 sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Trouver ma région</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Score basé uniquement sur des données vérifiées (façade maritime, accès
              Shinkansen, couverture forestière, neige). &quot;Peu importe&quot; exclut le
              critère du score plutôt que de le neutraliser à moitié — aucun critère non
              choisi n&apos;influence le résultat.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <PreferenceField label="Façade maritime importante ?">
            <RadioGroup
              value={coastal}
              onValueChange={(v) => setCoastal(v as PreferenceChoice)}
              className="flex gap-4"
            >
              {BINARY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value={opt.value} />
                  {opt.label}
                </label>
              ))}
            </RadioGroup>
          </PreferenceField>

          <PreferenceField label="Accès à une gare Shinkansen important ?">
            <RadioGroup
              value={shinkansen}
              onValueChange={(v) => setShinkansen(v as PreferenceChoice)}
              className="flex gap-4"
            >
              {BINARY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value={opt.value} />
                  {opt.label}
                </label>
              ))}
            </RadioGroup>
          </PreferenceField>

          <PreferenceField label="Cadre très boisé / rural recherché ?">
            <RadioGroup
              value={rural}
              onValueChange={(v) => setRural(v as PreferenceChoice)}
              className="flex gap-4"
            >
              {BINARY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value={opt.value} />
                  {opt.label}
                </label>
              ))}
            </RadioGroup>
          </PreferenceField>

          <PreferenceField label="Rapport à la neige ?">
            <RadioGroup value={snow} onValueChange={(v) => setSnow(v as SnowPreference)} className="flex flex-wrap gap-4">
              {SNOW_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value={opt.value} />
                  {opt.label}
                </label>
              ))}
            </RadioGroup>
          </PreferenceField>
        </div>

        {!budget && (
          <p className="mt-4 text-xs text-muted-foreground">
            Renseignez votre budget à l&apos;étape 4 pour inclure la compatibilité
            financière dans ce score.
          </p>
        )}

        <div className="mt-6 border-t border-border pt-4">
          {!hasAnyPreference ? (
            <p className="text-sm text-muted-foreground">
              Choisissez au moins une préférence ci-dessus pour classer les régions.
            </p>
          ) : (
            <ul className="space-y-3">
              {scores.slice(0, 5).map((score, index) => (
                <RegionScoreRow
                  key={score.region.prefecture}
                  rank={index + 1}
                  score={score}
                  onSelect={() => onSelectRegion(score.region.prefecture)}
                />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function PreferenceField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-normal text-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RegionScoreRow({
  rank,
  score,
  onSelect,
}: {
  rank: number;
  score: RegionScore;
  onSelect: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const pct = score.maxPoints > 0 ? Math.round((score.totalPoints / score.maxPoints) * 100) : 0;

  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-foreground">
            {rank}. {score.region.prefecture.replace(/_/g, " ")}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            {score.totalPoints}/{score.maxPoints} pts ({pct}%) — {score.criteriaEvaluated}/
            {score.criteriaAvailable} critères évalués
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDetail((v) => !v)}>
            {showDetail ? "Masquer" : "Détail"}
          </Button>
          <Button size="sm" onClick={onSelect}>
            Choisir
          </Button>
        </div>
      </div>

      {showDetail && (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
          {score.criteria.map((c) => (
            <li key={c.key} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{c.label}</span>
              <span className="text-right text-foreground">
                {c.points}/{c.maxPoints} — {c.justification}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
