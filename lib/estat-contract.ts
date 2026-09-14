// Phase AN — e-Stat Data Contract.
//
// Contrat SEUL — pas d'import massif, pas de statistique inventée.
// e-Stat (政府統計の総合窓口) nécessite un ID d'application (Phase AA :
// gratuit, sans quota documenté) qui n'est pas encore configuré
// (`ESTAT_APP_ID`). Ce module définit la forme du futur résultat pour
// que le branchement, une fois l'ID reçu, soit un ajout de provider —
// pas une nouvelle architecture.

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

const ESTAT_SOURCE_NAME = "e-Stat — 政府統計の総合窓口 (provider non implémenté)";

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

// SERVEUR UNIQUEMENT, même discipline que le provider MLIT (Phase AC) :
// un futur ID d'application e-Stat ne doit jamais être exposé au
// navigateur.
export function fetchMunicipalityIndicator(
  municipalityCode: string | null,
  indicator: EstatIndicator,
): EstatResult {
  const fetchedAt = new Date().toISOString();

  if (!isServerEnvironment()) {
    return { status: "ERROR", metadata: { sourceName: ESTAT_SOURCE_NAME, fetchedAt } };
  }

  if (!municipalityCode) {
    return { status: "INSUFFICIENT_DATA", metadata: { sourceName: ESTAT_SOURCE_NAME, fetchedAt } };
  }

  // Phase AN = contrat uniquement : ESTAT_APP_ID n'existe pas encore,
  // donc toujours DATA_UNAVAILABLE, jamais une statistique inventée pour
  // combler l'absence de provider réel.
  void indicator;
  return { status: "DATA_UNAVAILABLE", metadata: { sourceName: ESTAT_SOURCE_NAME, fetchedAt } };
}
