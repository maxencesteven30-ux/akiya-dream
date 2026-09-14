import { describe, expect, it } from "vitest";
import { ESTAT_INDICATOR_LABELS } from "@/lib/estat-contract";

// La logique de récupération réelle est testée dans
// lib/estat/provider.test.ts — ce fichier ne teste plus que le contrat
// de types partagé (le seul rôle restant de ce module).
describe("ESTAT_INDICATOR_LABELS", () => {
  it("chaque indicateur documenté a un libellé, aucun inventé", () => {
    expect(Object.keys(ESTAT_INDICATOR_LABELS)).toEqual(["population", "population_change_rate", "households"]);
  });
});
