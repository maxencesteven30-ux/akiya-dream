// Contrat e-Stat (政府統計の総合窓口) — types partagés par
// lib/estat/provider.ts (implémentation réelle, ESTAT_APP_ID configuré
// depuis le 2026-09-15). Ce fichier ne contient plus que les types et
// libellés : la logique de récupération vit dans lib/estat/provider.ts,
// même convention que lib/mlit/provider.ts et lib/hazard/provider.ts.

export type EstatIndicator = "population" | "population_change_rate" | "households";

export const ESTAT_INDICATOR_LABELS: Record<EstatIndicator, string> = {
  population: "Population actuelle",
  population_change_rate: "Évolution démographique",
  households: "Nombre de ménages",
};

export type EstatStatus = "AVAILABLE" | "NOT_FOUND" | "DATA_UNAVAILABLE" | "INSUFFICIENT_DATA" | "ERROR";

export interface EstatDataPoint {
  municipalityCode: string;
  indicator: EstatIndicator;
  // Pour population/households : l'année du recensement/décompte utilisé
  // (ex. "2020"). Pour population_change_rate : les deux années
  // comparées (ex. "2015→2020"), jamais présenté comme un taux annuel.
  period: string;
  value: number;
  unit: string;
}

export interface EstatMetadata {
  sourceName: string;
  sourceUrl?: string;
  sourceDate?: string;
  fetchedAt: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
}

export interface EstatResult {
  status: EstatStatus;
  data?: EstatDataPoint;
  metadata: EstatMetadata;
}
