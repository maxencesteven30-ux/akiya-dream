// Phase AC — Fixtures MLIT SYNTHÉTIQUES, réservées aux TESTS.
//
// Ces transactions sont inventées pour couvrir des cas de test précis —
// elles ne doivent JAMAIS apparaître dans un parcours utilisateur réel.
// Garde-fou : toute importation de ce module hors de l'environnement de
// test fait immédiatement échouer le process, au chargement du module.
import type { MlitApiResponse, MlitTransactionRaw } from "@/lib/mlit/types";

if (process.env.NODE_ENV !== "test") {
  throw new Error(
    "lib/mlit/fixtures.ts contient des données SYNTHÉTIQUES réservées aux tests — " +
      "importation détectée hors de NODE_ENV=test. Ne jamais utiliser en production.",
  );
}

function synthetic(overrides: Partial<MlitTransactionRaw>): MlitTransactionRaw {
  return {
    PriceCategory: "SYNTHETIC / TEST ONLY",
    Type: "宅地(土地と建物)",
    Region: "住宅地",
    MunicipalityCode: "20201",
    Prefecture: "長野県",
    Municipality: "長野市",
    DistrictName: "SYNTHETIC",
    TradePrice: "5000000",
    PricePerUnit: "",
    FloorPlan: "",
    Area: "200",
    UnitPrice: "",
    LandShape: "ほぼ長方形",
    Frontage: "10",
    TotalFloorArea: "90",
    BuildingYear: "2000年",
    Structure: "",
    Use: "住宅",
    Purpose: "",
    Direction: "東",
    Classification: "",
    Breadth: "4",
    CityPlanning: "市街化区域",
    CoverageRatio: "60",
    FloorAreaRatio: "150",
    Period: "2024年第1四半期",
    Renovation: "",
    Remarks: "",
    DistrictCode: "SYNTHETIC-0",
    ...overrides,
  };
}

// 1. Plusieurs transactions comparables (même municipalité, surfaces/âges proches).
export const SYNTHETIC_MULTIPLE_COMPARABLES: MlitApiResponse = {
  status: "OK",
  data: [
    synthetic({ DistrictCode: "SYNTHETIC-1A", TradePrice: "4800000", Area: "195", BuildingYear: "1999年" }),
    synthetic({ DistrictCode: "SYNTHETIC-1B", TradePrice: "5200000", Area: "205", BuildingYear: "2001年" }),
    synthetic({ DistrictCode: "SYNTHETIC-1C", TradePrice: "5000000", Area: "200", BuildingYear: "2000年" }),
  ],
};

// 2. Aucune transaction.
export const SYNTHETIC_NO_TRANSACTIONS: MlitApiResponse = { status: "OK", data: [] };

// 3. Une seule transaction.
export const SYNTHETIC_SINGLE_TRANSACTION: MlitApiResponse = {
  status: "OK",
  data: [synthetic({ DistrictCode: "SYNTHETIC-3" })],
};

// 4. Transactions anciennes (hors période raisonnable de comparaison).
export const SYNTHETIC_OLD_TRANSACTIONS: MlitApiResponse = {
  status: "OK",
  data: [
    synthetic({ DistrictCode: "SYNTHETIC-4A", Period: "2006年第1四半期" }),
    synthetic({ DistrictCode: "SYNTHETIC-4B", Period: "2007年第3四半期" }),
  ],
};

// 5. Données partielles (champs essentiels manquants mais prix présent).
export const SYNTHETIC_PARTIAL_DATA: MlitApiResponse = {
  status: "OK",
  data: [
    synthetic({
      DistrictCode: "SYNTHETIC-5",
      Area: "",
      TotalFloorArea: "",
      BuildingYear: "",
      LandShape: "",
      CityPlanning: "",
    }),
  ],
};

// 6. Localisation insuffisante — représenté côté provider (pas de code
// municipal fourni), pas par une forme de transaction : voir provider.test.ts.

// 7. Fournisseur indisponible — représenté côté provider (clé absente).

// 8. Erreur API — réponse malformée.
export const SYNTHETIC_MALFORMED_RESPONSE = { unexpected: "shape" };

// 9. Prix atypique (très inférieur aux autres comparables du même lot).
export const SYNTHETIC_ATYPICAL_PRICE: MlitApiResponse = {
  status: "OK",
  data: [
    synthetic({ DistrictCode: "SYNTHETIC-9A", TradePrice: "4900000" }),
    synthetic({ DistrictCode: "SYNTHETIC-9B", TradePrice: "5100000" }),
    synthetic({ DistrictCode: "SYNTHETIC-9C", TradePrice: "800000" }), // atypique
  ],
};

// 10. Transactions hétérogènes (types/usages très différents entre elles).
export const SYNTHETIC_HETEROGENEOUS_TRANSACTIONS: MlitApiResponse = {
  status: "OK",
  data: [
    synthetic({ DistrictCode: "SYNTHETIC-10A", Use: "住宅", Area: "180", BuildingYear: "1995年" }),
    synthetic({ DistrictCode: "SYNTHETIC-10B", Use: "商業", Area: "800", BuildingYear: "2015年" }),
    synthetic({ DistrictCode: "SYNTHETIC-10C", Use: "農地", Area: "3000", BuildingYear: "" }),
  ],
};
