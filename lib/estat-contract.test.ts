import { describe, expect, it } from "vitest";
import { fetchMunicipalityIndicator, ESTAT_INDICATOR_LABELS } from "@/lib/estat-contract";

describe("fetchMunicipalityIndicator", () => {
  it("INSUFFICIENT_DATA sans code municipal", () => {
    const result = fetchMunicipalityIndicator(null, "population");
    expect(result.status).toBe("INSUFFICIENT_DATA");
  });

  it("DATA_UNAVAILABLE avec un code municipal : provider pas encore implémenté, jamais une statistique inventée", () => {
    const result = fetchMunicipalityIndicator("20201", "population");
    expect(result.status).toBe("DATA_UNAVAILABLE");
    expect(result.data).toBeUndefined();
  });

  it("chaque indicateur documenté a un libellé, aucun inventé", () => {
    expect(Object.keys(ESTAT_INDICATOR_LABELS)).toEqual(["population", "population_change_rate", "households"]);
  });

  it("les métadonnées incluent toujours fetchedAt", () => {
    const result = fetchMunicipalityIndicator("20201", "households");
    expect(result.metadata.fetchedAt).toBeTruthy();
  });
});
