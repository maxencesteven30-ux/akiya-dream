import { fetchMlitEndpoint } from "@/lib/mlit/fetch-mlit";

// XIT002 — liste des communes d'une préfecture (不動産情報ライブラリ).
// Vérifié par appel réel authentifié le 2026-09-15 pour les 18 codes
// préfecture utilisés par data/regions.json (cf. lib/japan-prefectures.ts) :
// réponse gzip-encodée, JSON {status:"OK", data:[{id, name}]} — id est le
// code municipal à 5 chiffres déjà utilisé par MLIT (XPT002/XKT0xx) et
// e-Stat, name le nom en japonais (jamais de romanisation fournie).
//
// Existe pour remplacer la saisie manuelle d'un code à 5 chiffres
// (jusqu'ici "à chercher sur le site du MLIT") par un choix dans une
// liste réelle — le point de blocage identifié le 2026-09-15 : un
// utilisateur n'ayant pas encore de bien précis ne pouvait obtenir aucune
// donnée de commune, faute de code à saisir.

export type MunicipalitySearchStatus = "FOUND" | "EMPTY" | "DATA_UNAVAILABLE" | "ERROR";

export interface MunicipalityEntry {
  code: string;
  nameJa: string;
}

export interface MunicipalitySearchResult {
  status: MunicipalitySearchStatus;
  municipalities: MunicipalityEntry[];
}

const MUNICIPALITIES_ENDPOINT = "https://www.reinfolib.mlit.go.jp/ex-api/external/XIT002";

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

interface MunicipalitiesApiResponse {
  status: string;
  data: { id: string; name: string }[];
}

function isMunicipalitiesApiResponse(value: unknown): value is MunicipalitiesApiResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    Array.isArray((value as { data: unknown }).data)
  );
}

export async function fetchMunicipalities(
  prefectureCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MunicipalitySearchResult> {
  if (!isServerEnvironment()) {
    return { status: "ERROR", municipalities: [] };
  }

  const apiKey = process.env.MLIT_API_KEY;
  if (!apiKey) {
    return { status: "DATA_UNAVAILABLE", municipalities: [] };
  }

  const url = new URL(MUNICIPALITIES_ENDPOINT);
  url.searchParams.set("area", prefectureCode);

  const outcome = await fetchMlitEndpoint(url.toString(), apiKey, fetchImpl);
  if (outcome.kind === "network_error" || outcome.kind === "http_error") {
    return { status: "ERROR", municipalities: [] };
  }
  if (outcome.kind === "auth_failure") {
    return { status: "DATA_UNAVAILABLE", municipalities: [] };
  }

  const json = outcome.json;
  if (!isMunicipalitiesApiResponse(json)) {
    return { status: "ERROR", municipalities: [] };
  }

  const municipalities = json.data
    .filter((entry) => typeof entry.id === "string" && typeof entry.name === "string")
    .map((entry) => ({ code: entry.id, nameJa: entry.name }));

  return { status: municipalities.length > 0 ? "FOUND" : "EMPTY", municipalities };
}
