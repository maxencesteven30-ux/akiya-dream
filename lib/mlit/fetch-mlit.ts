// Extrait de lib/mlit/provider.ts, lib/mlit/land-price-provider.ts,
// lib/hazard/provider.ts, lib/demographics/provider.ts et
// lib/amenities/provider.ts — les cinq réimplémentaient exactement la
// même logique de transport (timeout, en-tête d'authentification,
// 401/403, parsing JSON), à l'identique. Optimisation pure, aucun
// changement de comportement : chaque appelant garde son propre mapping
// vers son propre statut métier (UNAVAILABLE/DATA_UNAVAILABLE, etc.).

export type MlitFetchOutcome =
  | { kind: "ok"; json: unknown }
  | { kind: "auth_failure" }
  | { kind: "http_error" }
  | { kind: "network_error" };

const DEFAULT_TIMEOUT_MS = 10_000;
const AUTH_FAILURE_STATUSES = [401, 403];

// Toutes les API 不動産情報ライブラリ / 国土数値情報 utilisées dans ce
// projet partagent le même en-tête d'authentification et la même
// discipline d'erreur (401/403 = clé invalide -> source indisponible,
// pas une panne réseau ponctuelle).
export async function fetchMlitEndpoint(
  url: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<MlitFetchOutcome> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      signal: timeoutController.signal,
    });
  } catch {
    return { kind: "network_error" };
  } finally {
    clearTimeout(timeoutId);
  }

  if (AUTH_FAILURE_STATUSES.includes(response.status)) {
    return { kind: "auth_failure" };
  }
  if (!response.ok) {
    return { kind: "http_error" };
  }

  try {
    const json = await response.json();
    return { kind: "ok", json };
  } catch {
    return { kind: "http_error" };
  }
}
