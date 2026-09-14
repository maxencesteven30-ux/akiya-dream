"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Extrait de discovery-section.tsx / search-profile-editor.tsx (Phase AP) —
// le même trio "valeur booléenne optionnelle <-> select à 3 états" était
// dupliqué 7 fois entre les deux fichiers. Le libellé de l'état "non
// renseigné" reste personnalisable (unknownLabel) : "Non renseigné" pour
// un fait constaté sur une annonce, "Non décidé" pour un critère de
// recherche que l'utilisateur n'a pas encore tranché — une nuance
// volontaire, pas un doublon accidentel.

export function parseTriState(raw: string | null): boolean | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

export function triStateValue(value: boolean | null): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "unknown";
}

const DEFAULT_UNKNOWN_LABEL = "Non renseigné";

interface TriStateSelectProps {
  id: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  unknownLabel?: string;
}

export function TriStateSelect({ id, value, onChange, unknownLabel = DEFAULT_UNKNOWN_LABEL }: TriStateSelectProps) {
  const options = [
    { value: "unknown", label: unknownLabel },
    { value: "true", label: "Oui" },
    { value: "false", label: "Non" },
  ];
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  return (
    <Select value={triStateValue(value)} onValueChange={(v) => onChange(parseTriState(v))}>
      <SelectTrigger id={id}>
        <SelectValue>{labelOf}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
