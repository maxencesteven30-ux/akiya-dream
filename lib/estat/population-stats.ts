// Era 9 (suite) — parseur pour la table e-Stat 0000020101 (社会・人口
// 統計体系「市区町村データ 基礎データ（オリジナル）A 人口・世帯」).
// Schéma vérifié par appel réel authentifié le 2026-09-15 (長野市,
// area code 20201 — le même code à 5 chiffres que celui déjà utilisé
// partout ailleurs dans l'app pour MLIT, aucune conversion nécessaire) :
//   - cat01 "A1101" = 総人口 (population totale), unité 人.
//   - cat01 "A7101" = 世帯数 (nombre de ménages), unité 世帯.
//   - time "YYYY......" : les 4 premiers chiffres sont l'année
//     d'enquête (ex. "2020100000" -> 2020) — le recensement n'a lieu
//     que tous les 5 ans, donc la plupart des années intermédiaires
//     n'ont simplement aucune entrée (pas une valeur manquante à
//     combler, une absence réelle).
//   - une valeur non numérique ("-", "X", "***" — respectivement
//     "donnée non obtenue", "secret statistique", "non enquêté/agrégé",
//     documentés dans DATA_INF.NOTE) n'est jamais convertie en donnée :
//     Number(...) échoue naturellement sur ces trois symboles, donc
//     aucun traitement spécial n'est requis pour les exclure.

export interface EstatYearValue {
  year: number;
  value: number;
}

interface EstatValueEntry {
  "@cat01"?: string;
  "@time"?: string;
  "@unit"?: string;
  $?: string;
}

interface EstatApiResponse {
  GET_STATS_DATA?: {
    RESULT?: { STATUS?: number };
    STATISTICAL_DATA?: {
      DATA_INF?: { VALUE?: EstatValueEntry[] };
    };
  };
}

export function isEstatApiResponse(value: unknown): value is EstatApiResponse {
  return typeof value === "object" && value !== null && "GET_STATS_DATA" in value;
}

const YEAR_PREFIX = /^(\d{4})/;

// Extrait, pour un code cat01 donné, la série année/valeur triée par
// année croissante — jamais deux implémentations parallèles pour lire
// la même forme de réponse e-Stat.
export function parseEstatSeries(json: EstatApiResponse, cat01Code: string): EstatYearValue[] {
  const entries = json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE ?? [];

  const series: EstatYearValue[] = [];
  for (const entry of entries) {
    if (entry["@cat01"] !== cat01Code) continue;
    const yearMatch = entry["@time"]?.match(YEAR_PREFIX);
    if (!yearMatch) continue;
    const value = Number(entry.$);
    if (!Number.isFinite(value)) continue;
    series.push({ year: Number(yearMatch[1]), value });
  }

  return series.sort((a, b) => a.year - b.year);
}

export function latestValue(series: EstatYearValue[]): EstatYearValue | null {
  return series.length > 0 ? series[series.length - 1] : null;
}

// Les deux points les plus récents disponibles — jamais supposés
// consécutifs à 5 ans d'intervalle exacts (une année peut être
// supprimée pour secret statistique), donc l'intervalle réel est
// toujours rapporté explicitement (cf. computeChangeRate).
export function lastTwoValues(series: EstatYearValue[]): [EstatYearValue, EstatYearValue] | null {
  if (series.length < 2) return null;
  return [series[series.length - 2], series[series.length - 1]];
}

export interface EstatChangeRate {
  fromYear: number;
  toYear: number;
  ratePercent: number;
}

// Taux calculé à partir de deux décomptes réels — jamais un taux
// officiel publié tel quel : documenté comme une valeur dérivée, avec
// les deux années exactes utilisées, jamais présenté comme "le taux
// annuel" (l'intervalle n'est pas forcément 5 ans si une année
// intermédiaire est supprimée).
export function computeChangeRate(series: EstatYearValue[]): EstatChangeRate | null {
  const pair = lastTwoValues(series);
  if (!pair) return null;
  const [from, to] = pair;
  if (from.value === 0) return null;
  return {
    fromYear: from.year,
    toYear: to.year,
    ratePercent: ((to.value - from.value) / from.value) * 100,
  };
}
