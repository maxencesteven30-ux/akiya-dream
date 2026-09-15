// Table des codes préfecture JIS (全国地方公共団体コード, 2 chiffres),
// norme du Ministère des Affaires intérieures et des Communications
// (総務省) — https://www.soumu.go.jp/denshijiti/code.html. Chaque code
// ci-dessous a été revérifié le 2026-09-15 par un appel réel à l'API
// MLIT XIT002 (liste des communes d'une préfecture) : la première
// commune retournée pour chaque code correspond bien à une ville connue
// de la préfecture attendue (ex. code 46 -> 鹿児島市, code 28 -> 神戸市).
//
// `label` correspond à la valeur "prefecture" de data/regions.json,
// dépouillée de tout suffixe de sous-région (ex. "Fukuoka_Periph" ->
// "Fukuoka") : plusieurs entrées de regions.json désignent une
// sous-région d'une préfecture réelle, jamais une préfecture inventée.
export interface JapanPrefecture {
  label: string;
  nameJa: string;
  code: string;
}

export const JAPAN_PREFECTURES: JapanPrefecture[] = [
  { label: "Hokkaido", nameJa: "北海道", code: "01" },
  { label: "Aomori", nameJa: "青森県", code: "02" },
  { label: "Niigata", nameJa: "新潟県", code: "15" },
  { label: "Gifu", nameJa: "岐阜県", code: "21" },
  { label: "Nagano", nameJa: "長野県", code: "20" },
  { label: "Hyogo", nameJa: "兵庫県", code: "28" },
  { label: "Wakayama", nameJa: "和歌山県", code: "30" },
  { label: "Tottori", nameJa: "鳥取県", code: "31" },
  { label: "Shimane", nameJa: "島根県", code: "32" },
  { label: "Okayama", nameJa: "岡山県", code: "33" },
  { label: "Yamaguchi", nameJa: "山口県", code: "35" },
  { label: "Tokushima", nameJa: "徳島県", code: "36" },
  { label: "Ehime", nameJa: "愛媛県", code: "38" },
  { label: "Fukuoka", nameJa: "福岡県", code: "40" },
  { label: "Kumamoto", nameJa: "熊本県", code: "43" },
  { label: "Oita", nameJa: "大分県", code: "44" },
  { label: "Miyazaki", nameJa: "宮崎県", code: "45" },
  { label: "Kagoshima", nameJa: "鹿児島県", code: "46" },
];

// "Fukuoka_Periph" -> "Fukuoka", "Hyogo_Rural" -> "Hyogo", etc. Les
// libellés de data/regions.json sans suffixe restent inchangés.
export function basePrefectureLabel(regionLabel: string): string {
  return regionLabel.split("_")[0];
}

export function findPrefectureByRegionLabel(regionLabel: string): JapanPrefecture | null {
  const base = basePrefectureLabel(regionLabel);
  return JAPAN_PREFECTURES.find((p) => p.label === base) ?? null;
}
