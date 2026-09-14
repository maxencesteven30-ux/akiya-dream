import { describe, expect, it, vi } from "vitest";
import { fetchMlitEndpoint } from "@/lib/mlit/fetch-mlit";

function mockFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }) as unknown as typeof fetch;
}

function mockFetchWithStatus(status: number): typeof fetch {
  return vi
    .fn()
    .mockResolvedValue({ ok: false, status, json: () => Promise.resolve({}) }) as unknown as typeof fetch;
}

describe("fetchMlitEndpoint", () => {
  it("ok avec le JSON parsé quand la réponse est valide", async () => {
    const outcome = await fetchMlitEndpoint("https://example.test", "key", mockFetch({ hello: "world" }));
    expect(outcome).toEqual({ kind: "ok", json: { hello: "world" } });
  });

  it("auth_failure sur 401 et 403, jamais confondu avec http_error", async () => {
    expect(await fetchMlitEndpoint("https://example.test", "key", mockFetchWithStatus(401))).toEqual({
      kind: "auth_failure",
    });
    expect(await fetchMlitEndpoint("https://example.test", "key", mockFetchWithStatus(403))).toEqual({
      kind: "auth_failure",
    });
  });

  it("http_error sur un autre statut non ok (ex. 429, 500)", async () => {
    expect(await fetchMlitEndpoint("https://example.test", "key", mockFetchWithStatus(429))).toEqual({
      kind: "http_error",
    });
    expect(await fetchMlitEndpoint("https://example.test", "key", mockFetchWithStatus(500))).toEqual({
      kind: "http_error",
    });
  });

  it("http_error si le JSON ne parse pas, jamais un blocage", async () => {
    const failing = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("bad json")),
    }) as unknown as typeof fetch;
    expect(await fetchMlitEndpoint("https://example.test", "key", failing)).toEqual({ kind: "http_error" });
  });

  it("network_error sur une exception réseau/timeout", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    expect(await fetchMlitEndpoint("https://example.test", "key", failing)).toEqual({ kind: "network_error" });
  });

  it("transmet l'en-tête Ocp-Apim-Subscription-Key et un AbortSignal", async () => {
    const fetchSpy = mockFetch({});
    await fetchMlitEndpoint("https://example.test", "my-key", fetchSpy);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.test",
      expect.objectContaining({
        headers: { "Ocp-Apim-Subscription-Key": "my-key" },
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
