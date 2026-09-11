import buildingErasData from "@/data/building_eras.json";
import type { BuildingEra, BuildingEraCode } from "@/lib/types";

const BUILDING_ERAS = buildingErasData as BuildingEra[];

// Bornes explicites, alignées sur le jeu de données source :
// PRE_1981 = "Before 1981", POST_1981 = "1981 - 2000", POST_2000 = "2000 - Present".
export function getBuildingEraCode(constructionYear: number): BuildingEraCode {
  if (constructionYear < 1981) return "PRE_1981";
  if (constructionYear < 2000) return "POST_1981";
  return "POST_2000";
}

export function getBuildingEra(code: BuildingEraCode): BuildingEra {
  const era = BUILDING_ERAS.find((e) => e.code === code);
  if (!era) {
    throw new Error(`Ère de construction inconnue dans building_eras.json : ${code}`);
  }
  return era;
}

export function getBuildingEraForYear(constructionYear: number): BuildingEra {
  return getBuildingEra(getBuildingEraCode(constructionYear));
}
