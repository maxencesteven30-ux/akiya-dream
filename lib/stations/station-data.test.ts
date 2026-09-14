import { describe, expect, it } from "vitest";
import { latestRidership, parseStationFeature } from "@/lib/stations/station-data";

describe("parseStationFeature", () => {
  it("extrait nom/exploitant/ligne et la fréquentation par année (données réelles vérifiées, 善光寺下)", () => {
    const info = parseStationFeature({
      S12_001_ja: "善光寺下",
      S12_002_ja: "長野電鉄",
      S12_003_ja: "長野線",
      S12_009: 1102, // 2011
      S12_013: 1250, // 2012
    });
    expect(info?.name).toBe("善光寺下");
    expect(info?.operator).toBe("長野電鉄");
    expect(info?.line).toBe("長野線");
    expect(info?.ridership).toEqual([
      { year: 2011, passengers: 1102 },
      { year: 2012, passengers: 1250 },
    ]);
  });

  it("retourne null si le nom de la gare est absent, jamais un nom inventé", () => {
    expect(parseStationFeature({ S12_002_ja: "長野電鉄" })).toBeNull();
    expect(parseStationFeature({})).toBeNull();
  });

  it("ignore une année sans valeur numérique, jamais un chiffre deviné", () => {
    const info = parseStationFeature({ S12_001_ja: "駅", S12_009: "非公開" });
    expect(info?.ridership).toEqual([]);
  });

  it("exploitant/ligne inconnus restent '—', jamais une valeur inventée", () => {
    const info = parseStationFeature({ S12_001_ja: "駅" });
    expect(info?.operator).toBe("—");
    expect(info?.line).toBe("—");
  });
});

describe("latestRidership", () => {
  it("retourne la dernière année disponible", () => {
    const info = parseStationFeature({
      S12_001_ja: "駅",
      S12_009: 1000,
      S12_057: 900,
    });
    expect(latestRidership(info!)).toEqual({ year: 2023, passengers: 900 });
  });

  it("null si aucune année n'a de valeur exploitable", () => {
    const info = parseStationFeature({ S12_001_ja: "駅" });
    expect(latestRidership(info!)).toBeNull();
  });
});
