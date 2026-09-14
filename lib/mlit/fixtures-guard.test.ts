import { describe, expect, it, vi, afterEach } from "vitest";

// Garde-fou anti-fixture-en-production : lib/mlit/fixtures.ts doit
// refuser de se charger si NODE_ENV n'est pas "test" — vérifié ici en
// simulant un environnement non-test avant l'import.

describe("lib/mlit/fixtures.ts — garde-fou anti-production", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("refuse de se charger si NODE_ENV n'est pas 'test'", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    await expect(import("@/lib/mlit/fixtures")).rejects.toThrow(/SYNTHÉTIQUES réservées aux tests/);
  });

  it("se charge normalement en environnement de test", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    await expect(import("@/lib/mlit/fixtures")).resolves.toBeTruthy();
  });
});
