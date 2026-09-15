import { describe, expect, it } from "vitest";
import {
  isConstructionCostApiResponse,
  latestConstructionCostPerSqm,
  parseConstructionCostSeries,
  type ConstructionCostApiResponse,
} from "@/lib/estat/construction-cost";

function makeResponse(
  entries: { tab: string; cat01: string; time: string; value: string }[],
): ConstructionCostApiResponse {
  return {
    GET_STATS_DATA: {
      RESULT: { STATUS: 0 },
      STATISTICAL_DATA: {
        DATA_INF: {
          VALUE: entries.map((e) => ({ "@tab": e.tab, "@cat01": e.cat01, "@time": e.time, $: e.value })),
        },
      },
    },
  };
}

describe("isConstructionCostApiResponse", () => {
  it("reconnaît une réponse e-Stat valide", () => {
    expect(isConstructionCostApiResponse(makeResponse([]))).toBe(true);
  });

  it("rejette une valeur qui n'a pas la forme attendue", () => {
    expect(isConstructionCostApiResponse(null)).toBe(false);
    expect(isConstructionCostApiResponse({})).toBe(false);
    expect(isConstructionCostApiResponse("texte")).toBe(false);
  });
});

describe("parseConstructionCostSeries", () => {
  it("calcule la surface et le coût réels (万円 converti en JPY) pour une année complète", () => {
    const json = makeResponse([
      { tab: "13", cat01: "12", time: "2023100000", value: "607662" },
      { tab: "14", cat01: "12", time: "2023100000", value: "12719481" },
    ]);
    const series = parseConstructionCostSeries(json);
    expect(series).toEqual([{ fiscalYear: 2023, totalFloorAreaM2: 607662, totalCostJpy: 127194810000 }]);
  });

  it("ignore une année où une seule des deux valeurs (surface OU coût) est présente", () => {
    const json = makeResponse([
      { tab: "13", cat01: "12", time: "2022100000", value: "500000" },
      // pas de tab=14 pour 2022 : jamais extrapolé
      { tab: "13", cat01: "12", time: "2023100000", value: "607662" },
      { tab: "14", cat01: "12", time: "2023100000", value: "12719481" },
    ]);
    const series = parseConstructionCostSeries(json);
    expect(series).toHaveLength(1);
    expect(series[0].fiscalYear).toBe(2023);
  });

  it("ignore les cat01 autres que 木造 (12), jamais mélangés dans un même total", () => {
    const json = makeResponse([
      { tab: "13", cat01: "15", time: "2023100000", value: "999999" }, // 鉄骨造
      { tab: "14", cat01: "15", time: "2023100000", value: "999999" },
      { tab: "13", cat01: "12", time: "2023100000", value: "607662" },
      { tab: "14", cat01: "12", time: "2023100000", value: "12719481" },
    ]);
    const series = parseConstructionCostSeries(json);
    expect(series).toHaveLength(1);
    expect(series[0].totalFloorAreaM2).toBe(607662);
  });

  it("trie par année croissante et gère plusieurs années valides", () => {
    const json = makeResponse([
      { tab: "13", cat01: "12", time: "2023100000", value: "600000" },
      { tab: "14", cat01: "12", time: "2023100000", value: "12000000" },
      { tab: "13", cat01: "12", time: "2021100000", value: "500000" },
      { tab: "14", cat01: "12", time: "2021100000", value: "10000000" },
    ]);
    const series = parseConstructionCostSeries(json);
    expect(series.map((s) => s.fiscalYear)).toEqual([2021, 2023]);
  });

  it("ignore une valeur non numérique sans planter", () => {
    const json = makeResponse([
      { tab: "13", cat01: "12", time: "2023100000", value: "-" },
      { tab: "14", cat01: "12", time: "2023100000", value: "12000000" },
    ]);
    expect(parseConstructionCostSeries(json)).toHaveLength(0);
  });
});

describe("latestConstructionCostPerSqm", () => {
  it("retourne null pour une série vide", () => {
    expect(latestConstructionCostPerSqm([])).toBeNull();
  });

  it("calcule le coût au m² de l'année la plus récente", () => {
    const result = latestConstructionCostPerSqm([
      { fiscalYear: 2021, totalFloorAreaM2: 500000, totalCostJpy: 100_000_000_000 },
      { fiscalYear: 2023, totalFloorAreaM2: 607662, totalCostJpy: 127_194_810_000 },
    ]);
    expect(result).toEqual({ fiscalYear: 2023, costPerSqmJpy: 209318 });
  });
});
