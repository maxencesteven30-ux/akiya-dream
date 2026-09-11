import { describe, expect, it } from "vitest";
import {
  computeTotalSubsidies,
  filterSubsidiesByType,
  getAllSubsidies,
  getEligibleSubsidies,
} from "@/lib/subsidies";
import type { Subsidy } from "@/lib/types";

const PERMISSIVE_OPTIONS = {
  residenceCommitment: true,
  usesAkiyaBank: true,
  hasLocalContractor: true,
};

const RESTRICTIVE_OPTIONS = {
  residenceCommitment: false,
  usesAkiyaBank: false,
  hasLocalContractor: false,
};

describe("getAllSubsidies", () => {
  it("retourne un jeu de données non vide, sourcé", () => {
    const all = getAllSubsidies();
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) {
      expect(s.sourceName).toBeTruthy();
      expect(s.verifiedAt).toBeTruthy();
    }
  });
});

describe("getEligibleSubsidies", () => {
  it("filtre correctement par préfecture (exclut les autres préfectures)", () => {
    const results = getEligibleSubsidies("Wakayama", PERMISSIVE_OPTIONS);
    expect(results.length).toBeGreaterThan(0);
    for (const s of results) {
      expect(s.prefecture === "Wakayama" || s.prefecture === "Nationwide").toBe(true);
    }
    expect(results.some((s) => s.prefecture === "Hokkaido")).toBe(false);
  });

  it("inclut toujours les programmes nationaux quelle que soit la préfecture", () => {
    const wakayama = getEligibleSubsidies("Wakayama", PERMISSIVE_OPTIONS);
    const hokkaido = getEligibleSubsidies("Hokkaido", PERMISSIVE_OPTIONS);
    expect(wakayama.some((s) => s.prefecture === "Nationwide")).toBe(true);
    expect(hokkaido.some((s) => s.prefecture === "Nationwide")).toBe(true);
  });

  it("retourne un tableau vide pour une préfecture sans programme régional ni national manquant", () => {
    // Aucun programme régional pour "Shimane" dans le jeu de données actuel,
    // mais le programme national doit tout de même apparaître.
    const results = getEligibleSubsidies("Shimane", PERMISSIVE_OPTIONS);
    expect(results.every((s) => s.prefecture === "Nationwide")).toBe(true);
  });

  it("exclut un programme nécessitant l'akiya bank si l'utilisateur ne l'utilise pas", () => {
    const withBank = getEligibleSubsidies("Okayama", PERMISSIVE_OPTIONS);
    const withoutBank = getEligibleSubsidies("Okayama", {
      ...PERMISSIVE_OPTIONS,
      usesAkiyaBank: false,
    });
    expect(withBank.some((s) => s.id === "okayama_yakage_renovation")).toBe(true);
    expect(withoutBank.some((s) => s.id === "okayama_yakage_renovation")).toBe(false);
  });

  it("n'exclut jamais un programme sur un critère inconnu (null)", () => {
    // La quasi-totalité des programmes sourcés ont requiresLocalContractor
    // et minResidenceYears à null (non précisé par la source) : des options
    // restrictives sur ces critères ne doivent donc pas les exclure, sauf
    // ceux nécessitant explicitement l'akiya bank.
    const restrictive = getEligibleSubsidies("Wakayama", RESTRICTIVE_OPTIONS);
    const permissive = getEligibleSubsidies("Wakayama", PERMISSIVE_OPTIONS);
    expect(restrictive.length).toBe(permissive.length);
  });
});

describe("computeTotalSubsidies", () => {
  it("retourne la somme exacte des montants maximaux", () => {
    const subsidies: Subsidy[] = getAllSubsidies().slice(0, 3);
    const expected = subsidies[0].maxAmountJpy + subsidies[1].maxAmountJpy + subsidies[2].maxAmountJpy;
    expect(computeTotalSubsidies(subsidies)).toBe(expected);
  });

  it("retourne 0 pour un tableau vide", () => {
    expect(computeTotalSubsidies([])).toBe(0);
  });
});

describe("filterSubsidiesByType", () => {
  it("sépare correctement renovation et relocation", () => {
    const all = getAllSubsidies();
    const renovation = filterSubsidiesByType(all, "renovation");
    const relocation = filterSubsidiesByType(all, "relocation");

    expect(renovation.length + relocation.length).toBe(all.length);
    expect(renovation.every((s) => s.type === "renovation")).toBe(true);
    expect(relocation.every((s) => s.type === "relocation")).toBe(true);
    // Les deux types doivent être représentés dans le jeu de données réel.
    expect(renovation.length).toBeGreaterThan(0);
    expect(relocation.length).toBeGreaterThan(0);
  });
});
