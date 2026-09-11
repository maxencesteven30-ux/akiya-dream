"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CARETAKER_LABELS,
  CHECK_FREQUENCY_LABELS,
  NON_RESIDENT_ADMIN_TEMPLATE,
  NON_RESIDENT_TAX_DISCLAIMER,
  OWNERSHIP_GOAL_LABELS,
  OWNERSHIP_PURPOSE_LABELS,
  RESIDENCE_LOCATION_LABELS,
  USAGE_FREQUENCY_LABELS,
  VACANCY_DURATION_LABELS,
  VACANT_HOME_TAX_DISCLAIMER,
  VISA_DISCLAIMER,
  computeNonResidentAdminSummary,
  computeVacancyRisk,
  shouldShowVisaWarning,
} from "@/lib/remote-owner";
import type {
  CaretakerType,
  CheckFrequency,
  OwnershipGoal,
  OwnershipPurpose,
  RemoteOwnerProfile,
  ResidenceLocation,
  UsageFrequency,
  VacancyDuration,
} from "@/lib/types";

interface RemoteOwnerSectionProps {
  profile: RemoteOwnerProfile;
  onChange: <K extends keyof RemoteOwnerProfile>(key: K, value: RemoteOwnerProfile[K]) => void;
  onAdminItemChange: (itemId: string, done: boolean) => void;
}

// Sentinelle UI pour "non renseigné" : un Select Base UI doit toujours
// recevoir une valeur définie pour rester contrôlé dès le premier rendu
// (bug déjà rencontré et corrigé en Phase V sur ce même composant Select
// avec value={x ?? undefined}).
const NOT_SET = "non_renseigne";

interface EnumSelectProps<T extends string> {
  value: T | null;
  onChange: (value: T | null) => void;
  labels: Record<T, string>;
  className?: string;
}

function EnumSelect<T extends string>({ value, onChange, labels, className }: EnumSelectProps<T>) {
  const options = Object.keys(labels) as T[];
  return (
    <Select
      value={value ?? NOT_SET}
      onValueChange={(v) => {
        if (!v) return;
        onChange(v === NOT_SET ? null : (v as T));
      }}
    >
      <SelectTrigger className={className ?? "w-full"}>
        <SelectValue>
          {(v: T | typeof NOT_SET) => (v === NOT_SET ? "Non renseigné" : (labels[v] ?? v))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NOT_SET}>Non renseigné</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {labels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const RISK_STYLES: Record<"vert" | "orange" | "rouge", string> = {
  vert: "border-emerald-600/30 bg-emerald-600/5",
  orange: "border-amber-600/30 bg-amber-600/5",
  rouge: "border-destructive/30 bg-destructive/5",
};

export function RemoteOwnerSection({ profile, onChange, onAdminItemChange }: RemoteOwnerSectionProps) {
  const vacancyRisk = useMemo(
    () =>
      computeVacancyRisk({
        vacancyDuration: profile.vacancyDuration,
        caretaker: profile.caretaker,
        checkFrequency: profile.checkFrequency,
      }),
    [profile.vacancyDuration, profile.caretaker, profile.checkFrequency],
  );
  const adminSummary = useMemo(
    () => computeNonResidentAdminSummary(profile.nonResidentAdmin),
    [profile.nonResidentAdmin],
  );
  const showVisaWarning = shouldShowVisaWarning(profile.ownershipGoal, profile.visaPlanConfirmed);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        🌐 Remote Owner
      </h2>
      <p className="mb-5 text-lg text-foreground">
        Que va me coûter cette maison si je ne vis pas au Japon ?
      </p>

      <Card className="border-border p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-sm">Lieu de résidence</Label>
            <EnumSelect<ResidenceLocation>
              value={profile.residenceLocation}
              onChange={(v) => onChange("residenceLocation", v)}
              labels={RESIDENCE_LOCATION_LABELS}
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-sm">Quel est ton objectif ?</Label>
            <EnumSelect<OwnershipGoal>
              value={profile.ownershipGoal}
              onChange={(v) => onChange("ownershipGoal", v)}
              labels={OWNERSHIP_GOAL_LABELS}
            />
          </div>
        </div>

        {profile.residenceLocation === "hors_japon" && (
          <p className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
            🇯🇵 {VISA_DISCLAIMER}
          </p>
        )}

        {showVisaWarning && (
          <div className="mt-3 rounded-md border border-amber-600/30 bg-amber-600/5 p-3">
            <p className="text-sm font-medium text-foreground">⚠️ Attention</p>
            <p className="mt-1 text-sm text-foreground">{VISA_DISCLAIMER}</p>
            <Label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-normal text-muted-foreground">
              <Checkbox
                checked={profile.visaPlanConfirmed}
                onCheckedChange={(checked) => onChange("visaPlanConfirmed", checked === true)}
              />
              J&apos;ai un projet de statut de séjour compatible
            </Label>
          </div>
        )}
      </Card>

      <Card className="mt-4 border-border p-6 sm:p-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          🗓️ Fréquence d&apos;utilisation
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-sm">J&apos;y habiterai</Label>
            <EnumSelect<UsageFrequency>
              value={profile.usageFrequency}
              onChange={(v) => onChange("usageFrequency", v)}
              labels={USAGE_FREQUENCY_LABELS}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">
              Combien de temps la maison restera-t-elle vide ?
            </Label>
            <EnumSelect<VacancyDuration>
              value={profile.vacancyDuration}
              onChange={(v) => onChange("vacancyDuration", v)}
              labels={VACANCY_DURATION_LABELS}
            />
          </div>
        </div>
      </Card>

      <Card className="mt-4 border-border p-6 sm:p-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          🏡 Plan de gestion pendant l&apos;absence
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-sm">Qui vérifie la maison ?</Label>
            <EnumSelect<CaretakerType>
              value={profile.caretaker}
              onChange={(v) => onChange("caretaker", v)}
              labels={CARETAKER_LABELS}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">À quelle fréquence ?</Label>
            <EnumSelect<CheckFrequency>
              value={profile.checkFrequency}
              onChange={(v) => onChange("checkFrequency", v)}
              labels={CHECK_FREQUENCY_LABELS}
            />
          </div>
        </div>

        <div className={`mt-4 rounded-md border p-3 ${RISK_STYLES[vacancyRisk.level]}`}>
          <p className="text-sm font-medium text-foreground">{vacancyRisk.label}</p>
          {vacancyRisk.reasons.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {vacancyRisk.reasons.map((reason, i) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="mt-4 border-border p-6 sm:p-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          💰 Type de projet
        </p>
        <EnumSelect<OwnershipPurpose>
          value={profile.ownershipPurpose}
          onChange={(v) => onChange("ownershipPurpose", v)}
          labels={OWNERSHIP_PURPOSE_LABELS}
          className="w-full sm:w-80"
        />
        {(profile.ownershipPurpose === "residence_secondaire" ||
          profile.ownershipPurpose === "vacante_travaux") && (
          <p className="mt-3 text-xs text-muted-foreground">⚠️ {VACANT_HOME_TAX_DISCLAIMER}</p>
        )}
      </Card>

      {profile.residenceLocation === "hors_japon" && (
        <Card className="mt-4 border-border p-6 sm:p-8">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              🌐 Propriétaire non-résident
            </p>
            <span className="text-sm font-medium text-foreground">
              {adminSummary.completed} / {adminSummary.total}
            </span>
          </div>
          <ul className="space-y-2">
            {NON_RESIDENT_ADMIN_TEMPLATE.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={profile.nonResidentAdmin[item.id] === true}
                  onCheckedChange={(checked) => onAdminItemChange(item.id, checked === true)}
                />
                <span className="text-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">{NON_RESIDENT_TAX_DISCLAIMER}</p>
        </Card>
      )}
    </motion.section>
  );
}
