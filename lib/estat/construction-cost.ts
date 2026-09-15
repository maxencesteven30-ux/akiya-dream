// Parseur pour la table e-Stat 0003117509 (建築着工統計調査 建築物着工統計
// 6-1「都道府県別、構造別／建築物の数、床面積、工事費予定額」). Vérifié par
// appel réel authentifié le 2026-09-15 (鹿児島県, area code 46000,
// cat01=12 木造/bois) : réponse réelle {tab:"13" (床面積, m2), value:
// "607662"} et {tab:"14" (工事費予定額, 万円), value: "12719481"} pour
// l'année 2023 — soit 12 719 481 * 10 000 / 607 662 ≈ 209 318 JPY/m².
//
// Portée volontairement limitée à cat01=12 (木造, ossature bois) : c'est
// la structure de construction dominante des akiya, donc la plus
// pertinente comme référence régionale — jamais mélangée avec les
// structures béton/acier (cat01 différent) sous un chiffre agrégé
// unique qui masquerait la nature du bâtiment.
//
// IMPORTANT — ce n'est PAS un coût de rénovation : 建築着工統計 mesure les
// mises en chantier de bâtiments NEUFS (constructions déclarées),
// jamais des travaux de rénovation sur un bâtiment existant. C'est la
// meilleure référence régionale réelle disponible pour évaluer un ordre
// de grandeur du coût de la construction dans une préfecture donnée —
// à ne jamais présenter comme équivalent aux forfaits de rénovation
// (RENOVATION_COST_PER_SQM_JPY, lib/calculations.ts), qui restent des
// moyennes nationales sourcées séparément pour un usage différent.

const WOODEN_CAT01_CODE = "12";
const FLOOR_AREA_TAB_CODE = "13";
const COST_TAB_CODE = "14";
// Le tableau exprime le coût en 万円 (unité de 10 000 JPY) — jamais un
// prix en JPY brut malgré l'apparence numérique.
const MANEN_TO_JPY = 10_000;

interface ConstructionCostValueEntry {
  "@tab"?: string;
  "@cat01"?: string;
  "@time"?: string;
  $?: string;
}

export interface ConstructionCostApiResponse {
  GET_STATS_DATA?: {
    RESULT?: { STATUS?: number };
    STATISTICAL_DATA?: {
      DATA_INF?: { VALUE?: ConstructionCostValueEntry[] };
    };
  };
}

export function isConstructionCostApiResponse(value: unknown): value is ConstructionCostApiResponse {
  return typeof value === "object" && value !== null && "GET_STATS_DATA" in value;
}

export interface ConstructionCostYearPoint {
  fiscalYear: number;
  totalFloorAreaM2: number;
  totalCostJpy: number;
}

const YEAR_PREFIX = /^(\d{4})/;

// Le tableau croise deux dimensions (tab, cat01) contrairement à la
// table démographie (une seule, cat01) — une année n'est exploitable
// que si SES DEUX valeurs (surface ET coût) sont présentes, jamais
// l'une extrapolée à partir de l'autre.
export function parseConstructionCostSeries(json: ConstructionCostApiResponse): ConstructionCostYearPoint[] {
  const entries = json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE ?? [];

  const byYear = new Map<number, { areaM2?: number; costJpy?: number }>();
  for (const entry of entries) {
    if (entry["@cat01"] !== WOODEN_CAT01_CODE) continue;
    const yearMatch = entry["@time"]?.match(YEAR_PREFIX);
    if (!yearMatch) continue;
    const value = Number(entry.$);
    if (!Number.isFinite(value)) continue;

    const year = Number(yearMatch[1]);
    const record = byYear.get(year) ?? {};
    if (entry["@tab"] === FLOOR_AREA_TAB_CODE) record.areaM2 = value;
    if (entry["@tab"] === COST_TAB_CODE) record.costJpy = value * MANEN_TO_JPY;
    byYear.set(year, record);
  }

  const points: ConstructionCostYearPoint[] = [];
  for (const [fiscalYear, record] of byYear) {
    if (record.areaM2 != null && record.costJpy != null && record.areaM2 > 0) {
      points.push({ fiscalYear, totalFloorAreaM2: record.areaM2, totalCostJpy: record.costJpy });
    }
  }

  return points.sort((a, b) => a.fiscalYear - b.fiscalYear);
}

export interface ConstructionCostPerSqm {
  fiscalYear: number;
  costPerSqmJpy: number;
}

export function latestConstructionCostPerSqm(points: ConstructionCostYearPoint[]): ConstructionCostPerSqm | null {
  if (points.length === 0) return null;
  const latest = points[points.length - 1];
  return {
    fiscalYear: latest.fiscalYear,
    costPerSqmJpy: Math.round(latest.totalCostJpy / latest.totalFloorAreaM2),
  };
}
