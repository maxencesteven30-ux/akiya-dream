// Phase AC — MLIT Contract Sandbox.
//
// Forme exacte de l'API 不動産情報ライブラリ XIT001 (transactions
// immobilières), vérifiée manuellement le 2026-09-14 par un appel réel
// authentifié : GET https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001
// (en-tête Ocp-Apim-Subscription-Key). Aucun champ ci-dessous n'est
// deviné — tous proviennent d'une réponse réelle de l'API.

// Réponse brute de l'API : tous les champs sont des chaînes (y compris
// les nombres et années), et un champ non renseigné est une chaîne vide
// — jamais absent, jamais null. C'est le format MLIT lui-même, pas un
// choix d'Akiya Dream.
export interface MlitTransactionRaw {
  PriceCategory: string;
  Type: string;
  Region: string;
  MunicipalityCode: string;
  Prefecture: string;
  Municipality: string;
  DistrictName: string;
  TradePrice: string;
  PricePerUnit: string;
  FloorPlan: string;
  Area: string;
  UnitPrice: string;
  LandShape: string;
  Frontage: string;
  TotalFloorArea: string;
  BuildingYear: string;
  Structure: string;
  Use: string;
  Purpose: string;
  Direction: string;
  Classification: string;
  Breadth: string;
  CityPlanning: string;
  CoverageRatio: string;
  FloorAreaRatio: string;
  Period: string;
  Renovation: string;
  Remarks: string;
  DistrictCode: string;
}

export interface MlitApiResponse {
  status: string;
  data: MlitTransactionRaw[];
}

// Transaction normalisée pour Akiya Dream : chaque champ optionnel côté
// source reste `null` s'il était vide — jamais une valeur déduite ou
// une moyenne de substitution.
export interface MlitTransaction {
  municipalityCode: string;
  prefecture: string;
  municipality: string;
  districtName: string;
  tradePriceJpy: number;
  areaM2: number | null;
  totalFloorAreaM2: number | null;
  buildingYear: number | null;
  structure: string | null;
  use: string | null;
  landShape: string | null;
  cityPlanning: string | null;
  period: string;
  districtCode: string;
}

// "1990年" -> 1990. Retourne null si le champ est vide ou non
// parsable — jamais une année devinée.
function parseJapaneseYear(raw: string): number | null {
  const match = raw.match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

function parseOptionalNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseOptionalString(raw: string): string | null {
  return raw.trim() === "" ? null : raw;
}

// Une transaction sans prix exploitable (TradePrice vide/non numérique)
// est rejetée — jamais affichée avec un prix à 0 ou inventé.
export function parseMlitTransaction(raw: MlitTransactionRaw): MlitTransaction | null {
  const tradePriceJpy = parseOptionalNumber(raw.TradePrice);
  if (tradePriceJpy === null) return null;

  return {
    municipalityCode: raw.MunicipalityCode,
    prefecture: raw.Prefecture,
    municipality: raw.Municipality,
    districtName: raw.DistrictName,
    tradePriceJpy,
    areaM2: parseOptionalNumber(raw.Area),
    totalFloorAreaM2: parseOptionalNumber(raw.TotalFloorArea),
    buildingYear: parseJapaneseYear(raw.BuildingYear),
    structure: parseOptionalString(raw.Structure),
    use: parseOptionalString(raw.Use),
    landShape: parseOptionalString(raw.LandShape),
    cityPlanning: parseOptionalString(raw.CityPlanning),
    period: raw.Period,
    districtCode: raw.DistrictCode,
  };
}
