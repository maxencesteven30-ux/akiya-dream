import { describe, expect, it } from "vitest";
import {
  classifyMunicipalityType,
  groupMunicipalitiesByType,
  MUNICIPALITY_TYPE_LABELS,
} from "@/lib/mlit/municipality-type";

describe("classifyMunicipalityType", () => {
  it("reconnaît les 4 suffixes réels", () => {
    expect(classifyMunicipalityType("鹿児島市")).toBe("市");
    expect(classifyMunicipalityType("千代田区")).toBe("区");
    expect(classifyMunicipalityType("さつま町")).toBe("町");
    expect(classifyMunicipalityType("三島村")).toBe("村");
  });

  it("retourne null pour un nom sans suffixe reconnu", () => {
    expect(classifyMunicipalityType("Atlantide")).toBeNull();
  });

  it("a un libellé pour chacun des 4 types", () => {
    expect(Object.keys(MUNICIPALITY_TYPE_LABELS)).toHaveLength(4);
  });
});

describe("groupMunicipalitiesByType", () => {
  const entries = [
    { code: "46201", nameJa: "鹿児島市" },
    { code: "46303", nameJa: "三島村" },
    { code: "46392", nameJa: "さつま町" },
    { code: "46225", nameJa: "姶良市" },
    { code: "46304", nameJa: "十島村" },
  ];

  it("groupe dans l'ordre 市 > 区 > 町 > 村, en préservant l'ordre interne", () => {
    const grouped = groupMunicipalitiesByType(entries);
    expect(grouped.map((g) => g.type)).toEqual(["市", "町", "村"]);
    expect(grouped[0].entries.map((e) => e.code)).toEqual(["46201", "46225"]);
    expect(grouped[1].entries.map((e) => e.code)).toEqual(["46392"]);
    expect(grouped[2].entries.map((e) => e.code)).toEqual(["46303", "46304"]);
  });

  it("omet les groupes vides plutôt que de les afficher vides", () => {
    const grouped = groupMunicipalitiesByType([{ code: "13101", nameJa: "千代田区" }]);
    expect(grouped).toEqual([{ type: "区", entries: [{ code: "13101", nameJa: "千代田区" }] }]);
  });

  it("retourne un tableau vide pour une liste vide", () => {
    expect(groupMunicipalitiesByType([])).toEqual([]);
  });
});
