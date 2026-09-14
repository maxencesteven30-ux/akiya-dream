import type { EstatDataPoint, EstatIndicator, EstatResult } from "@/lib/estat-contract";
import {
  computeChangeRate,
  isEstatApiResponse,
  latestValue,
  parseEstatSeries,
} from "@/lib/estat/population-stats";

// Era 9 (suite) — provider e-Stat réel (政府統計の総合窓口, table
// 0000020101 「社会・人口統計体系 市区町村データ 基礎データ（オリジナル）
// A 人口・世帯」). Même discipline que les autres providers (serveur
// uniquement, timeout, jamais une statistique inventée en l'absence de
// donnée) — adaptée au vocabulaire propre à e-Stat (pas de 401/403
// documenté pour un appId invalide : l'API renvoie un JSON avec un
// RESULT.STATUS non nul, jamais un code HTTP d'erreur).
//
// Vérifié par appel réel authentifié le 2026-09-15 (長野市, code
// 20201 — même code à 5 chiffres déjà utilisé pour MLIT, aucune
// conversion nécessaire) : population totale 1980->2020 réellement
// déclinante depuis le pic de 2010 (381 511 -> 372 760).

const ESTAT_SOURCE_NAME = "e-Stat — 政府統計の総合窓口 (社会・人口統計体系)";
const ESTAT_SOURCE_URL =
  "https://www.e-stat.go.jp/dbview?sid=0000020101";
const ESTAT_ENDPOINT = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData";
const ESTAT_STATS_DATA_ID = "0000020101";
const REQUEST_TIMEOUT_MS = 10_000;

// Codes cat01 vérifiés par appel réel — population_change_rate réutilise
// la même série que population (A1101), jamais une deuxième série
// parallèle pour la même donnée sous-jacente.
const POPULATION_CAT01 = "A1101";
const HOUSEHOLDS_CAT01 = "A7101";

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

async function fetchSeries(
  municipalityCode: string,
  cat01Code: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; json: unknown } | { ok: false }> {
  const url = new URL(ESTAT_ENDPOINT);
  const appId = process.env.ESTAT_APP_ID;
  url.searchParams.set("appId", appId ?? "");
  url.searchParams.set("statsDataId", ESTAT_STATS_DATA_ID);
  url.searchParams.set("cdArea", municipalityCode);
  url.searchParams.set("cdCat01", cat01Code);

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url.toString(), { signal: timeoutController.signal });
    if (!response.ok) return { ok: false };
    const json = await response.json();
    return { ok: true, json };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchMunicipalityIndicator(
  municipalityCode: string | null,
  indicator: EstatIndicator,
  fetchImpl: typeof fetch = fetch,
): Promise<EstatResult> {
  const fetchedAt = new Date().toISOString();
  const baseMetadata = { sourceName: ESTAT_SOURCE_NAME, sourceUrl: ESTAT_SOURCE_URL, fetchedAt };

  if (!isServerEnvironment()) {
    return { status: "ERROR", metadata: baseMetadata };
  }

  if (!municipalityCode) {
    return { status: "INSUFFICIENT_DATA", metadata: baseMetadata };
  }

  const appId = process.env.ESTAT_APP_ID;
  if (!appId) {
    return { status: "DATA_UNAVAILABLE", metadata: baseMetadata };
  }

  const cat01Code = indicator === "households" ? HOUSEHOLDS_CAT01 : POPULATION_CAT01;
  const fetchOutcome = await fetchSeries(municipalityCode, cat01Code, fetchImpl);
  if (!fetchOutcome.ok) {
    return { status: "ERROR", metadata: baseMetadata };
  }

  if (!isEstatApiResponse(fetchOutcome.json)) {
    return { status: "ERROR", metadata: baseMetadata };
  }

  // e-Stat signale un appId invalide ou une requête malformée par un
  // RESULT.STATUS non nul dans un JSON 200 OK, jamais par un code HTTP
  // d'erreur — un statut non nul est donc traité comme la clé/requête
  // invalide (DATA_UNAVAILABLE), pas comme un incident réseau ponctuel.
  const resultStatus = fetchOutcome.json.GET_STATS_DATA?.RESULT?.STATUS;
  if (resultStatus !== 0) {
    return { status: "DATA_UNAVAILABLE", metadata: baseMetadata };
  }

  const series = parseEstatSeries(fetchOutcome.json, cat01Code);

  const confirmedMetadata = { ...baseMetadata, confidence: "HIGH" as const };

  if (indicator === "population_change_rate") {
    const rate = computeChangeRate(series);
    if (!rate) {
      return { status: "NOT_FOUND", metadata: confirmedMetadata };
    }
    const data: EstatDataPoint = {
      municipalityCode,
      indicator,
      period: `${rate.fromYear}→${rate.toYear}`,
      value: rate.ratePercent,
      unit: "%",
    };
    return { status: "AVAILABLE", data, metadata: { ...confirmedMetadata, sourceDate: data.period } };
  }

  const point = latestValue(series);
  if (!point) {
    return { status: "NOT_FOUND", metadata: confirmedMetadata };
  }

  const data: EstatDataPoint = {
    municipalityCode,
    indicator,
    period: String(point.year),
    value: point.value,
    unit: indicator === "households" ? "世帯" : "人",
  };
  return { status: "AVAILABLE", data, metadata: { ...confirmedMetadata, sourceDate: data.period } };
}
