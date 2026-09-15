// Classification du type administratif d'une commune japonaise à
// partir du dernier caractère de son nom officiel — jamais une
// supposition : chaque commune du Japon porte obligatoirement l'un de
// ces 4 suffixes (地方自治法), c'est la même règle que celle qui définit
// le type lui-même, pas une heuristique approximative. Vérifié sur les
// noms réels déjà obtenus via XIT002 (鹿児島市, 三島村, 千代田区,
// 北九州市, さつま町...).
//
// Sert uniquement à grouper la liste des communes pour l'orientation
// d'un utilisateur qui ne sait pas laquelle choisir dans une préfecture
// qu'il découvre — jamais une mesure de taille ou de population réelle
// (une ville "市" n'est pas garantie plus grande qu'un bourg "町" voisin,
// seulement plus probable en moyenne).
export type MunicipalityType = "市" | "区" | "町" | "村";

const TYPE_ORDER: MunicipalityType[] = ["市", "区", "町", "村"];

export const MUNICIPALITY_TYPE_LABELS: Record<MunicipalityType, string> = {
  市: "Villes (市)",
  区: "Arrondissements (区)",
  町: "Bourgs (町)",
  村: "Villages (村)",
};

export function classifyMunicipalityType(nameJa: string): MunicipalityType | null {
  const lastChar = nameJa.trim().slice(-1);
  return (TYPE_ORDER as string[]).includes(lastChar) ? (lastChar as MunicipalityType) : null;
}

export interface GroupedMunicipality<T> {
  type: MunicipalityType;
  entries: T[];
}

// Groupe en préservant l'ordre d'origine au sein de chaque groupe
// (le code MLIT à 5 chiffres, déjà une convention officielle stable).
// Une entrée dont le nom ne porte aucun des 4 suffixes attendus (jamais
// observé en pratique, mais possible en théorie) est placée dans un
// groupe "町" par défaut plutôt qu'exclue silencieusement — visible,
// jamais perdue.
export function groupMunicipalitiesByType<T extends { nameJa: string }>(
  entries: T[],
): GroupedMunicipality<T>[] {
  const groups = new Map<MunicipalityType, T[]>();
  for (const entry of entries) {
    const type = classifyMunicipalityType(entry.nameJa) ?? "町";
    const bucket = groups.get(type) ?? [];
    bucket.push(entry);
    groups.set(type, bucket);
  }
  return TYPE_ORDER.filter((type) => groups.has(type)).map((type) => ({
    type,
    entries: groups.get(type)!,
  }));
}
