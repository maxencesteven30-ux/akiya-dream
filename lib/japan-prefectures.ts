// Table des codes préfecture JIS (全国地方公共団体コード, 2 chiffres),
// norme du Ministère des Affaires intérieures et des Communications
// (総務省) — https://www.soumu.go.jp/denshijiti/code.html. Les 47
// préfectures, chacune revérifiée par appel réel à l'API MLIT XIT002
// (liste des communes d'une préfecture) le 2026-09-15 : la première
// commune retournée pour chaque code correspond bien à une ville connue
// de la préfecture attendue (ex. code 46 -> 鹿児島市, code 13 -> 千代田区).
//
// `label` correspond, pour les 18 préfectures présentes dans
// data/regions.json, à la valeur "prefecture" dépouillée de tout
// suffixe de sous-région (ex. "Fukuoka_Periph" -> "Fukuoka") — les 29
// préfectures restantes n'ont pas d'équivalent dans regions.json (pas de
// données économiques akiya curatées), mais l'onglet "La ville" n'a
// besoin que de ce code et de ce nom japonais pour fonctionner sur
// n'importe laquelle des 47.
export interface JapanPrefecture {
  label: string;
  nameJa: string;
  code: string;
}

export const JAPAN_PREFECTURES: JapanPrefecture[] = [
  { label: "Hokkaido", nameJa: "北海道", code: "01" },
  { label: "Aomori", nameJa: "青森県", code: "02" },
  { label: "Iwate", nameJa: "岩手県", code: "03" },
  { label: "Miyagi", nameJa: "宮城県", code: "04" },
  { label: "Akita", nameJa: "秋田県", code: "05" },
  { label: "Yamagata", nameJa: "山形県", code: "06" },
  { label: "Fukushima", nameJa: "福島県", code: "07" },
  { label: "Ibaraki", nameJa: "茨城県", code: "08" },
  { label: "Tochigi", nameJa: "栃木県", code: "09" },
  { label: "Gunma", nameJa: "群馬県", code: "10" },
  { label: "Saitama", nameJa: "埼玉県", code: "11" },
  { label: "Chiba", nameJa: "千葉県", code: "12" },
  { label: "Tokyo", nameJa: "東京都", code: "13" },
  { label: "Kanagawa", nameJa: "神奈川県", code: "14" },
  { label: "Niigata", nameJa: "新潟県", code: "15" },
  { label: "Toyama", nameJa: "富山県", code: "16" },
  { label: "Ishikawa", nameJa: "石川県", code: "17" },
  { label: "Fukui", nameJa: "福井県", code: "18" },
  { label: "Yamanashi", nameJa: "山梨県", code: "19" },
  { label: "Nagano", nameJa: "長野県", code: "20" },
  { label: "Gifu", nameJa: "岐阜県", code: "21" },
  { label: "Shizuoka", nameJa: "静岡県", code: "22" },
  { label: "Aichi", nameJa: "愛知県", code: "23" },
  { label: "Mie", nameJa: "三重県", code: "24" },
  { label: "Shiga", nameJa: "滋賀県", code: "25" },
  { label: "Kyoto", nameJa: "京都府", code: "26" },
  { label: "Osaka", nameJa: "大阪府", code: "27" },
  { label: "Hyogo", nameJa: "兵庫県", code: "28" },
  { label: "Nara", nameJa: "奈良県", code: "29" },
  { label: "Wakayama", nameJa: "和歌山県", code: "30" },
  { label: "Tottori", nameJa: "鳥取県", code: "31" },
  { label: "Shimane", nameJa: "島根県", code: "32" },
  { label: "Okayama", nameJa: "岡山県", code: "33" },
  { label: "Hiroshima", nameJa: "広島県", code: "34" },
  { label: "Yamaguchi", nameJa: "山口県", code: "35" },
  { label: "Tokushima", nameJa: "徳島県", code: "36" },
  { label: "Kagawa", nameJa: "香川県", code: "37" },
  { label: "Ehime", nameJa: "愛媛県", code: "38" },
  { label: "Kochi", nameJa: "高知県", code: "39" },
  { label: "Fukuoka", nameJa: "福岡県", code: "40" },
  { label: "Saga", nameJa: "佐賀県", code: "41" },
  { label: "Nagasaki", nameJa: "長崎県", code: "42" },
  { label: "Kumamoto", nameJa: "熊本県", code: "43" },
  { label: "Oita", nameJa: "大分県", code: "44" },
  { label: "Miyazaki", nameJa: "宮崎県", code: "45" },
  { label: "Kagoshima", nameJa: "鹿児島県", code: "46" },
  { label: "Okinawa", nameJa: "沖縄県", code: "47" },
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
