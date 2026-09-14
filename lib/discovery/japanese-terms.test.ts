import { describe, expect, it } from "vitest";
import {
  isMarkedAsAkiya,
  parseAreaM2,
  parseBuildingYearTerm,
  parseFloorPlan,
  parsePriceJpy,
  parseRebuildabilityTerm,
  parseSewageTerm,
  parseWalkingDistance,
} from "@/lib/discovery/japanese-terms";

describe("parseWalkingDistance", () => {
  it("parse '徒歩15分' en minutes à pied, jamais converti en distance métrique", () => {
    expect(parseWalkingDistance("徒歩15分")).toEqual({ value: 15, unit: "minutes_walk" });
  });

  it("gère un espace entre les tokens ('徒歩 15 分')", () => {
    expect(parseWalkingDistance("徒歩 15 分")).toEqual({ value: 15, unit: "minutes_walk" });
  });

  it("retourne null pour un format non reconnu, jamais une distance devinée", () => {
    expect(parseWalkingDistance("proche de la gare")).toBeNull();
    expect(parseWalkingDistance("")).toBeNull();
  });
});

describe("parseFloorPlan", () => {
  it("parse '3LDK' : 3 pièces + salon/salle à manger/cuisine", () => {
    expect(parseFloorPlan("3LDK")).toEqual({
      roomCount: 3,
      hasLiving: true,
      hasDining: true,
      hasKitchen: true,
      raw: "3LDK",
    });
  });

  it("parse '1K' : 1 pièce + cuisine seule", () => {
    expect(parseFloorPlan("1K")).toEqual({ roomCount: 1, hasLiving: false, hasDining: false, hasKitchen: true, raw: "1K" });
  });

  it("parse '4SLDK' (pièce de service comptée à part dans le suffixe S, roomCount reste 4)", () => {
    const result = parseFloorPlan("4SLDK");
    expect(result?.roomCount).toBe(4);
  });

  it("retourne null pour un format non standard, jamais un nombre de pièces deviné", () => {
    expect(parseFloorPlan("grand appartement")).toBeNull();
    expect(parseFloorPlan("")).toBeNull();
  });
});

describe("parseRebuildabilityTerm", () => {
  it("再建築不可 -> 'probleme'", () => {
    expect(parseRebuildabilityTerm("この土地は再建築不可です")).toBe("probleme");
  });

  it("再建築可 -> 'verifie'", () => {
    expect(parseRebuildabilityTerm("再建築可の土地です")).toBe("verifie");
  });

  it("absence des deux termes -> null, jamais deviné", () => {
    expect(parseRebuildabilityTerm("素晴らしい景色の家")).toBeNull();
  });
});

describe("parseSewageTerm", () => {
  it("公共下水 -> 'verifie'", () => {
    expect(parseSewageTerm("公共下水完備")).toBe("verifie");
  });

  it("浄化槽 -> 'verifie' (système fonctionnel, distinct du tout-à-l'égout)", () => {
    expect(parseSewageTerm("浄化槽設置済み")).toBe("verifie");
  });

  it("汲み取り -> 'probleme' (mapping explicite, pas un fait MLIT)", () => {
    expect(parseSewageTerm("汲み取り式")).toBe("probleme");
  });

  it("absence de terme connu -> null", () => {
    expect(parseSewageTerm("設備について要確認")).toBeNull();
  });
});

describe("parseAreaM2", () => {
  it("parse '123.45m²'", () => {
    expect(parseAreaM2("123.45m²")).toBe(123.45);
  });

  it("parse '1,234㎡' avec virgule de milliers", () => {
    expect(parseAreaM2("1,234㎡")).toBe(1234);
  });

  it("retourne null pour un format non numérique", () => {
    expect(parseAreaM2("非公開")).toBeNull();
  });
});

describe("parseBuildingYearTerm", () => {
  it("parse '1990年建築'", () => {
    expect(parseBuildingYearTerm("1990年建築")).toBe(1990);
  });

  it("parse une année brute sur 4 chiffres", () => {
    expect(parseBuildingYearTerm("1990")).toBe(1990);
  });

  it("parse '築30年' relatif à une année de référence fixée", () => {
    expect(parseBuildingYearTerm("築30年", 2026)).toBe(1996);
  });

  it("retourne null si aucun format reconnu, jamais une année devinée", () => {
    expect(parseBuildingYearTerm("ancien")).toBeNull();
  });
});

describe("parsePriceJpy", () => {
  it("parse '300万円' (convention des dizaines de milliers de yens)", () => {
    expect(parsePriceJpy("300万円")).toBe(3_000_000);
  });

  it("parse '3,000,000円' (montant direct en yens)", () => {
    expect(parsePriceJpy("3,000,000円")).toBe(3_000_000);
  });

  it("parse un montant brut sans 円", () => {
    expect(parsePriceJpy("3000000")).toBe(3_000_000);
  });

  it("retourne null pour un format non numérique, jamais un prix deviné", () => {
    expect(parsePriceJpy("価格応相談")).toBeNull();
    expect(parsePriceJpy("")).toBeNull();
  });
});

describe("isMarkedAsAkiya", () => {
  it("détecte 空き家 explicitement présent", () => {
    expect(isMarkedAsAkiya("空き家バンク登録物件")).toBe(true);
  });

  it("l'absence du terme ne devient jamais 'non vacante' de façon affirmée par cette fonction", () => {
    expect(isMarkedAsAkiya("中古住宅")).toBe(false);
  });
});
