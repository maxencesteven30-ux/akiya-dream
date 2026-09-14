import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchComparableTransactions } from "@/lib/mlit/provider";
import {
  SYNTHETIC_MULTIPLE_COMPARABLES,
  SYNTHETIC_NO_TRANSACTIONS,
  SYNTHETIC_SINGLE_TRANSACTION,
  SYNTHETIC_OLD_TRANSACTIONS,
  SYNTHETIC_PARTIAL_DATA,
  SYNTHETIC_MALFORMED_RESPONSE,
  SYNTHETIC_ATYPICAL_PRICE,
  SYNTHETIC_HETEROGENEOUS_TRANSACTIONS,
} from "@/lib/mlit/fixtures";

function mockFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }) as unknown as typeof fetch;
}

function mockFetchWithStatus(status: number): typeof fetch {
  return vi
    .fn()
    .mockResolvedValue({ ok: false, status, json: () => Promise.resolve({}) }) as unknown as typeof fetch;
}

const BASE_PARAMS = { municipalityCode: "20201", year: 2024, quarter: 1 as const };

describe("fetchComparableTransactions", () => {
  const originalKey = process.env.MLIT_API_KEY;

  beforeEach(() => {
    process.env.MLIT_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.MLIT_API_KEY = originalKey;
  });

  it("1. plusieurs transactions comparables → AVAILABLE avec toutes les transactions", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch(SYNTHETIC_MULTIPLE_COMPARABLES));
    expect(result.status).toBe("AVAILABLE");
    expect(result.data).toHaveLength(3);
  });

  it("2. aucune transaction → NOT_FOUND, jamais interprété comme un risque ou un prix confirmé", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch(SYNTHETIC_NO_TRANSACTIONS));
    expect(result.status).toBe("NOT_FOUND");
    expect(result.data).toEqual([]);
  });

  it("3. une seule transaction → AVAILABLE avec un seul élément", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch(SYNTHETIC_SINGLE_TRANSACTION));
    expect(result.status).toBe("AVAILABLE");
    expect(result.data).toHaveLength(1);
  });

  it("4. transactions anciennes → le champ period reste visible tel quel", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch(SYNTHETIC_OLD_TRANSACTIONS));
    expect(result.data?.every((t) => t.period.startsWith("200"))).toBe(true);
  });

  it("5. données partielles → les champs manquants restent null, jamais déduits", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch(SYNTHETIC_PARTIAL_DATA));
    expect(result.data?.[0].areaM2).toBeNull();
    expect(result.data?.[0].buildingYear).toBeNull();
  });

  it("6. localisation insuffisante (pas de code municipal) → INSUFFICIENT_LOCATION", async () => {
    const result = await fetchComparableTransactions(
      { ...BASE_PARAMS, municipalityCode: null },
      mockFetch(SYNTHETIC_MULTIPLE_COMPARABLES),
    );
    expect(result.status).toBe("INSUFFICIENT_LOCATION");
    expect(result.metadata.geographicPrecision).toBe("INSUFFICIENT");
  });

  it("7. fournisseur indisponible (clé absente) → UNAVAILABLE, jamais confondu avec NOT_FOUND", async () => {
    delete process.env.MLIT_API_KEY;
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch(SYNTHETIC_MULTIPLE_COMPARABLES));
    expect(result.status).toBe("UNAVAILABLE");
  });

  it("8a. réponse malformée → ERROR, pas de donnée fantôme", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch(SYNTHETIC_MALFORMED_RESPONSE));
    expect(result.status).toBe("ERROR");
    expect(result.data).toBeUndefined();
  });

  it("8b. erreur réseau → ERROR", async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await fetchComparableTransactions(BASE_PARAMS, failingFetch);
    expect(result.status).toBe("ERROR");
  });

  it("8d. timeout (AbortError) → ERROR, jamais un blocage indéfini", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const timingOutFetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;
    const result = await fetchComparableTransactions(BASE_PARAMS, timingOutFetch);
    expect(result.status).toBe("ERROR");
  });

  it("8e. 401 (clé invalide) → UNAVAILABLE, jamais ERROR (source mal configurée, pas une panne technique)", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetchWithStatus(401));
    expect(result.status).toBe("UNAVAILABLE");
  });

  it("8f. 403 (accès refusé) → UNAVAILABLE", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetchWithStatus(403));
    expect(result.status).toBe("UNAVAILABLE");
  });

  it("8g. 429 (limite de requêtes) → ERROR, jamais UNAVAILABLE (panne technique ponctuelle, pas une mauvaise configuration)", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetchWithStatus(429));
    expect(result.status).toBe("ERROR");
  });

  it("8c. réponse HTTP non ok → ERROR", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch({}, false));
    expect(result.status).toBe("ERROR");
  });

  it("9. prix atypique → transmis tel quel, aucune détection ici (rôle de la Phase AJ)", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch(SYNTHETIC_ATYPICAL_PRICE));
    expect(result.status).toBe("AVAILABLE");
    expect(result.data?.map((t) => t.tradePriceJpy)).toContain(800_000);
  });

  it("10. transactions hétérogènes → toutes renvoyées, la classification reste à un moteur séparé", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch(SYNTHETIC_HETEROGENEOUS_TRANSACTIONS));
    expect(result.data?.map((t) => t.use)).toEqual(["住宅", "商業", "農地"]);
  });

  it("transmet un AbortSignal à fetch (AD.1.2) — le timeout est réellement câblé, pas seulement documenté", async () => {
    const fetchSpy = mockFetch(SYNTHETIC_SINGLE_TRANSACTION);
    await fetchComparableTransactions(BASE_PARAMS, fetchSpy);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("inclut systématiquement source/date/fetchedAt dans les métadonnées", async () => {
    const result = await fetchComparableTransactions(BASE_PARAMS, mockFetch(SYNTHETIC_SINGLE_TRANSACTION));
    expect(result.metadata.sourceName).toMatch(/MLIT/);
    expect(result.metadata.sourceDate).toBe("2024Q1");
    expect(result.metadata.fetchedAt).toBeTruthy();
  });
});
