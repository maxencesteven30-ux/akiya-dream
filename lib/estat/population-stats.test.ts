import { describe, expect, it } from "vitest";
import {
  computeChangeRate,
  isEstatApiResponse,
  lastTwoValues,
  latestValue,
  parseEstatSeries,
} from "@/lib/estat/population-stats";

function apiResponse(values: { cat01: string; time: string; value: string }[]) {
  return {
    GET_STATS_DATA: {
      RESULT: { STATUS: 0 },
      STATISTICAL_DATA: {
        DATA_INF: {
          VALUE: values.map((v) => ({ "@cat01": v.cat01, "@time": v.time, $: v.value })),
        },
      },
    },
  };
}

describe("isEstatApiResponse", () => {
  it("reconnaît une réponse e-Stat réelle", () => {
    expect(isEstatApiResponse(apiResponse([]))).toBe(true);
  });

  it("rejette une valeur qui n'a pas la forme attendue", () => {
    expect(isEstatApiResponse({ unexpected: true })).toBe(false);
    expect(isEstatApiResponse(null)).toBe(false);
  });
});

describe("parseEstatSeries", () => {
  it("extrait la série année/valeur pour le bon code cat01, triée croissante", () => {
    const json = apiResponse([
      { cat01: "A1101", time: "2010100000", value: "381511" },
      { cat01: "A1101", time: "1980100000", value: "324360" },
      { cat01: "A7101", time: "2010100000", value: "150000" },
    ]);
    const series = parseEstatSeries(json, "A1101");
    expect(series).toEqual([
      { year: 1980, value: 324360 },
      { year: 2010, value: 381511 },
    ]);
  });

  it("ignore les valeurs non numériques (secret statistique X, absence -, non enquêté ***)", () => {
    const json = apiResponse([
      { cat01: "A1101", time: "2010100000", value: "X" },
      { cat01: "A1101", time: "2015100000", value: "-" },
      { cat01: "A1101", time: "2020100000", value: "***" },
      { cat01: "A1101", time: "2005100000", value: "378512" },
    ]);
    expect(parseEstatSeries(json, "A1101")).toEqual([{ year: 2005, value: 378512 }]);
  });

  it("une réponse sans données pour ce cat01 retourne une liste vide, jamais une exception", () => {
    expect(parseEstatSeries(apiResponse([]), "A1101")).toEqual([]);
    expect(() => parseEstatSeries(apiResponse([]), "A1101")).not.toThrow();
  });

  it("une réponse malformée (VALUE absent) retourne une liste vide", () => {
    expect(parseEstatSeries({ GET_STATS_DATA: {} }, "A1101")).toEqual([]);
  });
});

describe("latestValue / lastTwoValues", () => {
  it("latestValue retourne le point le plus récent", () => {
    const series = [
      { year: 1980, value: 324360 },
      { year: 2020, value: 372760 },
    ];
    expect(latestValue(series)).toEqual({ year: 2020, value: 372760 });
  });

  it("latestValue retourne null sur une série vide", () => {
    expect(latestValue([])).toBeNull();
  });

  it("lastTwoValues retourne null si moins de deux points", () => {
    expect(lastTwoValues([{ year: 2020, value: 1 }])).toBeNull();
    expect(lastTwoValues([])).toBeNull();
  });
});

describe("computeChangeRate", () => {
  it("calcule un taux négatif réel (déclin démographique de Nagano 2015->2020, vérifié)", () => {
    const series = [
      { year: 2015, value: 377598 },
      { year: 2020, value: 372760 },
    ];
    const rate = computeChangeRate(series);
    expect(rate?.fromYear).toBe(2015);
    expect(rate?.toYear).toBe(2020);
    expect(rate?.ratePercent).toBeCloseTo(-1.281, 2);
  });

  it("null si moins de deux points disponibles, jamais un taux inventé", () => {
    expect(computeChangeRate([{ year: 2020, value: 1 }])).toBeNull();
    expect(computeChangeRate([])).toBeNull();
  });

  it("null si la valeur de départ est 0, jamais une division par zéro silencieuse", () => {
    expect(
      computeChangeRate([
        { year: 2015, value: 0 },
        { year: 2020, value: 100 },
      ]),
    ).toBeNull();
  });
});
