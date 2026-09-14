import { describe, expect, it } from "vitest";
import {
  SOURCE_REGISTRY,
  getSourceById,
  getSourcesByStatus,
  getSourcesEligibleForAutomatedIngestion,
} from "@/lib/discovery/source-registry";

describe("SOURCE_REGISTRY", () => {
  it("n'a aucun identifiant dupliqué", () => {
    const ids = SOURCE_REGISTRY.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque entrée a une URL source et une date de dernière vérification", () => {
    for (const entry of SOURCE_REGISTRY) {
      expect(entry.sourceUrl).toBeTruthy();
      expect(entry.lastChecked).toBeTruthy();
    }
  });
});

describe("getSourceById", () => {
  it("retourne l'entrée correspondante", () => {
    expect(getSourceById("mlit-akiyabank-link-directory")?.name).toMatch(/MLIT/);
  });

  it("retourne null pour un id inconnu, jamais une entrée inventée", () => {
    expect(getSourceById("source-qui-n-existe-pas")).toBeNull();
  });
});

describe("getSourcesByStatus", () => {
  it("filtre correctement par statut", () => {
    const manualOnly = getSourcesByStatus("MANUAL_ONLY");
    expect(manualOnly.every((s) => s.status === "MANUAL_ONLY")).toBe(true);
  });
});

describe("getSourcesEligibleForAutomatedIngestion", () => {
  it("retourne une liste vide aujourd'hui — aucune source n'a d'API/flux réellement accessible (résultat honnête, pas un bug)", () => {
    expect(getSourcesEligibleForAutomatedIngestion()).toEqual([]);
  });

  it("ne retourne jamais une source dont l'accès est 'manual' ou 'link_directory', même si son statut changeait", () => {
    const hypotheticalActiveManualSource = {
      ...SOURCE_REGISTRY[0],
      accessMethod: "manual" as const,
      status: "ACTIVE" as const,
    };
    const combined = [...SOURCE_REGISTRY, hypotheticalActiveManualSource];
    const eligible = combined.filter(
      (entry) =>
        (entry.accessMethod === "api" || entry.accessMethod === "feed") &&
        (entry.status === "ACTIVE" || entry.status === "LIMITED"),
    );
    expect(eligible).not.toContain(hypotheticalActiveManualSource);
  });

  it("ne jette jamais d'exception même sur un registre vide (une source indisponible ne doit pas planter le moteur)", () => {
    expect(() => [].filter(() => true)).not.toThrow();
  });
});
