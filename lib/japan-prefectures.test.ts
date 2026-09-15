import { describe, expect, it } from "vitest";
import { basePrefectureLabel, findPrefectureByRegionLabel, JAPAN_PREFECTURES } from "@/lib/japan-prefectures";

describe("basePrefectureLabel", () => {
  it("laisse inchangé un libellé de préfecture simple", () => {
    expect(basePrefectureLabel("Kagoshima")).toBe("Kagoshima");
  });

  it("retire le suffixe de sous-région", () => {
    expect(basePrefectureLabel("Fukuoka_Periph")).toBe("Fukuoka");
    expect(basePrefectureLabel("Hyogo_Rural")).toBe("Hyogo");
  });
});

describe("findPrefectureByRegionLabel", () => {
  it("retrouve la préfecture pour un libellé simple", () => {
    expect(findPrefectureByRegionLabel("Kagoshima")).toEqual({
      label: "Kagoshima",
      nameJa: "鹿児島県",
      code: "46",
    });
  });

  it("retrouve la préfecture réelle pour un libellé de sous-région", () => {
    expect(findPrefectureByRegionLabel("Fukuoka_Periph")?.code).toBe("40");
    expect(findPrefectureByRegionLabel("Hyogo_Rural")?.code).toBe("28");
  });

  it("retourne null pour un libellé inconnu", () => {
    expect(findPrefectureByRegionLabel("Atlantide")).toBeNull();
  });

  it("chaque préfecture a un code à 2 chiffres unique", () => {
    const codes = JAPAN_PREFECTURES.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^\d{2}$/);
    }
  });

  it("couvre les 47 préfectures du Japon, codes 01 à 47", () => {
    expect(JAPAN_PREFECTURES).toHaveLength(47);
    const codes = JAPAN_PREFECTURES.map((p) => p.code).sort();
    const expected = Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, "0"));
    expect(codes).toEqual(expected);
  });

  it("chaque préfecture a un nom japonais unique et non vide", () => {
    const names = JAPAN_PREFECTURES.map((p) => p.nameJa);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
