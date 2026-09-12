// Phase AB — Akiya Reality Data Layer.
//
// Couche commune pour toute donnée provenant d'une source externe réelle
// (MLIT, e-Stat, taux de change...). Un seul contrat, jamais un fichier
// isolé par source avec sa propre logique. Toute donnée externe doit
// pouvoir répondre à "d'où vient cette donnée ?" et ne devient jamais
// automatiquement une vérité absolue : elle conserve sa source, sa date,
// sa précision et ses limites.

// AVAILABLE : donnée obtenue avec succès.
// NOT_FOUND : la source a répondu mais ne contient rien pour cette
//   requête (ex. aucune transaction comparable) — jamais interprété comme
//   "aucun risque"/"prix confirmé".
// INSUFFICIENT_LOCATION : la précision géographique disponible est
//   insuffisante pour interroger cette source de façon fiable.
// UNAVAILABLE : la source n'est pas configurée/accessible (ex. clé API
//   pas encore reçue) — jamais confondu avec NOT_FOUND.
// ERROR : l'appel a échoué techniquement (réseau, réponse invalide...).
export type RealityDataStatus =
  | "AVAILABLE"
  | "NOT_FOUND"
  | "INSUFFICIENT_LOCATION"
  | "UNAVAILABLE"
  | "ERROR";

// Confiance dans la précision/fraîcheur de la source elle-même — distinct
// de DataOrigin (fact/estimate/user_input/unknown, cf. lib/data-origin.ts)
// et de DataConfidence (verified/estimated/unknown, cf. région). Une
// donnée d'une API officielle n'est pas automatiquement "HIGH" : la
// source décide, jamais une supposition par défaut.
export type RealityDataConfidence = "HIGH" | "MEDIUM" | "LOW";

// Précision de la localisation utilisée pour interroger une source
// géographique. EXACT = coordonnées GPS. APPROXIMATE = géocodage
// indicatif (non utilisé aujourd'hui, réservé pour une future source de
// géocodage). MUNICIPALITY = seule la ville/commune est connue.
// INSUFFICIENT = rien d'exploitable.
export type GeographicPrecision = "EXACT" | "APPROXIMATE" | "MUNICIPALITY" | "INSUFFICIENT";

export const GEOGRAPHIC_PRECISION_LABELS: Record<GeographicPrecision, string> = {
  EXACT: "📍 Localisation précise",
  APPROXIMATE: "📍 Localisation approximative",
  MUNICIPALITY: "🏘️ Municipalité uniquement",
  INSUFFICIENT: "❓ Localisation insuffisante",
};

export interface RealityDataMetadata {
  sourceName: string;
  sourceUrl?: string;
  // Date de la donnée elle-même côté source (ex. date du taux, date de
  // publication du jeu de données) — distincte de fetchedAt.
  sourceDate?: string;
  // Horodatage de l'appel effectué par Akiya Dream, toujours renseigné.
  fetchedAt: string;
  confidence?: RealityDataConfidence;
  geographicPrecision?: GeographicPrecision;
}

export interface RealityDataResult<T> {
  status: RealityDataStatus;
  data?: T;
  metadata: RealityDataMetadata;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function makeRealityDataResult<T>(
  status: RealityDataStatus,
  metadata: Omit<RealityDataMetadata, "fetchedAt"> & { fetchedAt?: string },
  data?: T,
): RealityDataResult<T> {
  return {
    status,
    data,
    metadata: { ...metadata, fetchedAt: metadata.fetchedAt ?? nowIso() },
  };
}

// Une source non configurée (ex. clé API pas encore reçue) est
// UNAVAILABLE — jamais silencieusement absente ni confondue avec
// "aucune donnée trouvée" (NOT_FOUND).
export function unavailableResult(sourceName: string): RealityDataResult<never> {
  return makeRealityDataResult("UNAVAILABLE", { sourceName });
}

export function insufficientLocationResult(sourceName: string): RealityDataResult<never> {
  return makeRealityDataResult("INSUFFICIENT_LOCATION", {
    sourceName,
    geographicPrecision: "INSUFFICIENT",
  });
}

export function errorResult(sourceName: string): RealityDataResult<never> {
  return makeRealityDataResult("ERROR", { sourceName });
}
