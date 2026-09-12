import { makeRealityDataResult, errorResult, type RealityDataResult } from "@/lib/reality-data";

// Phase AF — FX Intelligence.
//
// Taux EUR/JPY réellement sourcé et daté, via Frankfurter (wrapper
// open-source des taux de référence de la Banque centrale européenne,
// https://www.frankfurter.dev) : aucune clé API requise, appel possible
// directement depuis le navigateur (CORS ouvert, vérifié), gratuit sans
// limite documentée. Vérifié manuellement le 2026-09-11 :
// curl https://api.frankfurter.dev/v1/latest?base=EUR&symbols=JPY
// → {"amount":1.0,"base":"EUR","date":"2026-09-11","rates":{"JPY":178.56}}
//
// Ne remplace jamais un rafraîchissement automatique par un
// rafraîchissement manuel explicite (cf. discipline "ne pas refaire les
// requêtes à chaque modification du formulaire") — l'appel doit être
// déclenché par une action utilisateur, jamais au montage silencieux.

export const FX_SOURCE_NAME = "Banque centrale européenne (taux de référence, via Frankfurter)";
export const FX_SOURCE_URL = "https://www.frankfurter.dev";
const FRANKFURTER_LATEST_URL = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=JPY";

export interface FxRate {
  pair: "EUR/JPY";
  rate: number;
  // Date du taux tel que publié par la source (jours ouvrés BCE
  // uniquement — pas de taux le week-end/jour férié).
  sourceDate: string;
}

interface FrankfurterLatestResponse {
  date?: string;
  rates?: { JPY?: number };
}

export async function fetchEurJpyRate(
  fetchImpl: typeof fetch = fetch,
): Promise<RealityDataResult<FxRate>> {
  let response: Response;
  try {
    response = await fetchImpl(FRANKFURTER_LATEST_URL);
  } catch {
    return errorResult(FX_SOURCE_NAME);
  }
  if (!response.ok) {
    return errorResult(FX_SOURCE_NAME);
  }

  let json: FrankfurterLatestResponse;
  try {
    json = (await response.json()) as FrankfurterLatestResponse;
  } catch {
    return errorResult(FX_SOURCE_NAME);
  }

  const rate = json.rates?.JPY;
  if (typeof rate !== "number" || !json.date) {
    return makeRealityDataResult("NOT_FOUND", { sourceName: FX_SOURCE_NAME, sourceUrl: FX_SOURCE_URL });
  }

  return makeRealityDataResult(
    "AVAILABLE",
    {
      sourceName: FX_SOURCE_NAME,
      sourceUrl: FX_SOURCE_URL,
      sourceDate: json.date,
      confidence: "HIGH",
    },
    { pair: "EUR/JPY", rate, sourceDate: json.date },
  );
}

export interface FxSensitivityPoint {
  deltaPercent: number;
  rate: number;
}

const SENSITIVITY_DELTAS_PERCENT = [-10, -5, 0, 5, 10];

// Simulation autour du taux actuel — jamais une prédiction du marché des
// changes. Les deltas sont des paliers de lecture, pas une probabilité.
export function computeFxSensitivity(baseRate: number): FxSensitivityPoint[] {
  return SENSITIVITY_DELTAS_PERCENT.map((deltaPercent) => ({
    deltaPercent,
    rate: baseRate * (1 + deltaPercent / 100),
  }));
}

export const FX_SENSITIVITY_DISCLAIMER =
  "Simulation autour du taux actuel — jamais une prédiction du marché des changes.";
