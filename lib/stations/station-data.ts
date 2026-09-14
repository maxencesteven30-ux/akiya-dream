// Era 9 (suite) — parseur pour XKT015 (国土数値情報「駅別乗降客数」).
// Schéma vérifié par la documentation officielle de l'endpoint le
// 2026-09-15 (pas seulement la page de synthèse) :
//   - S12_001_ja = nom de la gare, S12_002_ja = exploitant,
//     S12_003_ja = nom de la ligne.
//   - Le nombre de voyageurs par année suit une progression documentée
//     et vérifiée explicitement (pas devinée) : S12_009 = 乗降客数2011,
//     S12_013 = 乗降客数2012, ... S12_057 = 乗降客数2023 — un pas de 4
//     champs par année, en commençant à l'indice 9 pour 2011.

export interface StationYearlyRidership {
  year: number;
  passengers: number;
}

export interface StationInfo {
  name: string;
  operator: string;
  line: string;
  // Triée par année croissante.
  ridership: StationYearlyRidership[];
}

const FIRST_YEAR = 2011;
const LAST_YEAR = 2023;
const FIRST_FIELD_INDEX = 9;
const FIELD_STEP = 4;

function ridershipFieldName(year: number): string {
  const index = FIRST_FIELD_INDEX + FIELD_STEP * (year - FIRST_YEAR);
  return `S12_${String(index).padStart(3, "0")}`;
}

function readStringField(properties: Record<string, unknown>, key: string): string {
  const value = properties[key];
  return typeof value === "string" && value.trim() !== "" ? value : "—";
}

export function parseStationFeature(properties: Record<string, unknown>): StationInfo | null {
  const name = properties["S12_001_ja"];
  if (typeof name !== "string" || name.trim() === "") return null;

  const ridership: StationYearlyRidership[] = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const value = properties[ridershipFieldName(year)];
    if (typeof value === "number" && Number.isFinite(value)) {
      ridership.push({ year, passengers: value });
    }
  }

  return {
    name,
    operator: readStringField(properties, "S12_002_ja"),
    line: readStringField(properties, "S12_003_ja"),
    ridership,
  };
}

export function latestRidership(info: StationInfo): StationYearlyRidership | null {
  return info.ridership.length > 0 ? info.ridership[info.ridership.length - 1] : null;
}
