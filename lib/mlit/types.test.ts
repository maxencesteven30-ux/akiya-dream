import { describe, expect, it } from "vitest";
import { parseMlitTransaction, type MlitTransactionRaw } from "@/lib/mlit/types";

// Champs issus d'une réponse réelle de l'API XIT001 (vérifiée manuellement
// le 2026-09-14, ville=20201 Nagano) — pas une fixture inventée.
const REAL_SHAPE_TRANSACTION: MlitTransactionRaw = {
  PriceCategory: "不動産取引価格情報",
  Type: "宅地(土地と建物)",
  Region: "住宅地",
  MunicipalityCode: "20201",
  Prefecture: "長野県",
  Municipality: "長野市",
  DistrictName: "大字上ケ屋",
  TradePrice: "2200000",
  PricePerUnit: "",
  FloorPlan: "",
  Area: "210",
  UnitPrice: "",
  LandShape: "ほぼ長方形",
  Frontage: "12",
  TotalFloorArea: "40",
  BuildingYear: "1990年",
  Structure: "",
  Use: "住宅",
  Purpose: "",
  Direction: "東",
  Classification: "私道",
  Breadth: "3",
  CityPlanning: "市街化区域及び市街化調整区域外の都市計画区域",
  CoverageRatio: "40",
  FloorAreaRatio: "80",
  Period: "2023年第2四半期",
  Renovation: "",
  Remarks: "",
  DistrictCode: "202010040",
};

describe("parseMlitTransaction", () => {
  it("normalise une transaction réelle sans rien inventer", () => {
    const result = parseMlitTransaction(REAL_SHAPE_TRANSACTION);
    expect(result).toEqual({
      municipalityCode: "20201",
      prefecture: "長野県",
      municipality: "長野市",
      districtName: "大字上ケ屋",
      tradePriceJpy: 2_200_000,
      areaM2: 210,
      totalFloorAreaM2: 40,
      buildingYear: 1990,
      structure: null,
      use: "住宅",
      landShape: "ほぼ長方形",
      cityPlanning: "市街化区域及び市街化調整区域外の都市計画区域",
      period: "2023年第2四半期",
      districtCode: "202010040",
    });
  });

  it("rejette une transaction sans prix exploitable (jamais un prix à 0 inventé)", () => {
    const withoutPrice = { ...REAL_SHAPE_TRANSACTION, TradePrice: "" };
    expect(parseMlitTransaction(withoutPrice)).toBeNull();
  });

  it("rejette un TradePrice non numérique", () => {
    const malformed = { ...REAL_SHAPE_TRANSACTION, TradePrice: "非公開" };
    expect(parseMlitTransaction(malformed)).toBeNull();
  });

  it("convertit une année japonaise '1990年' en nombre 1990", () => {
    expect(parseMlitTransaction(REAL_SHAPE_TRANSACTION)?.buildingYear).toBe(1990);
  });

  it("retourne null pour BuildingYear vide, jamais une année devinée", () => {
    const noYear = { ...REAL_SHAPE_TRANSACTION, BuildingYear: "" };
    expect(parseMlitTransaction(noYear)?.buildingYear).toBeNull();
  });

  it("retourne null pour chaque champ optionnel vide plutôt qu'une chaîne vide", () => {
    const result = parseMlitTransaction(REAL_SHAPE_TRANSACTION);
    expect(result?.structure).toBeNull();
  });
});
