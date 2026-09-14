import type { RealityGateItemStatus } from "@/lib/types";
import type { StationDistance } from "@/lib/discovery/property-listing";

// Era 9 / Phase AF — vocabulaire immobilier japonais standard.
//
// Chaque parseur retourne `null` en cas d'ambiguïté — jamais une
// traduction incertaine transformée en affirmation certaine (section 10
// de la mission). Ces termes sont des conventions du secteur immobilier
// japonais, documentées et stables (pas une supposition propre à une
// source précise) : 徒歩X分 (X minutes à pied, convention ~80m/minute),
// 間取り (typologie de pièces, ex. "3LDK"), 再建築可/不可 (droit de
// reconstruire), 公共下水/浄化槽/汲み取り (types d'assainissement).

// "徒歩15分" -> {value: 15, unit: "minutes_walk"}. Ne convertit jamais en
// distance métrique (la convention ~80m/min est indicative, pas une
// mesure) — l'unité d'origine est toujours conservée telle quelle.
export function parseWalkingDistance(raw: string): StationDistance | null {
  const match = raw.match(/徒歩\s*(\d+)\s*分/);
  return match ? { value: Number(match[1]), unit: "minutes_walk" } : null;
}

export interface FloorPlanInfo {
  // Le nombre de pièces hors LDK/DK/K (ex. le "3" dans "3LDK") — jamais
  // assimilé silencieusement à un nombre de chambres : une pièce
  // japonaise (和室, etc.) ne correspond pas toujours à une chambre au
  // sens occidental.
  roomCount: number;
  hasLiving: boolean;
  hasDining: boolean;
  hasKitchen: boolean;
  raw: string;
}

// "3LDK", "2DK", "1K", "4SLDK" (S = pièce de service/stockage, comptée à
// part). Retourne null si le format ne correspond pas exactement à la
// convention standard — jamais un nombre de pièces deviné.
export function parseFloorPlan(raw: string): FloorPlanInfo | null {
  const match = raw.trim().match(/^(\d+)S?(LDK|DK|LK|K|L)$/);
  if (!match) return null;
  const suffix = match[2];
  return {
    roomCount: Number(match[1]),
    hasLiving: suffix.includes("L"),
    hasDining: suffix.includes("D"),
    hasKitchen: suffix.includes("K"),
    raw,
  };
}

// 再建築可 (rebuildable, droit de reconstruire confirmé) / 再建築不可
// (non reconstructible) — les deux termes légaux standard. Absence des
// deux mots-clés -> null (à traiter comme "a_confirmer" par l'appelant,
// jamais deviné ici).
export function parseRebuildabilityTerm(raw: string): RealityGateItemStatus | null {
  if (raw.includes("再建築不可")) return "probleme";
  if (raw.includes("再建築可")) return "verifie";
  return null;
}

// Assainissement : 公共下水 (tout-à-l'égout public, raccordé) / 浄化槽
// (fosse septique agréée, un système fonctionnel bien que distinct) /
// 汲み取り (fosse d'aisance non raccordée, système le plus rudimentaire —
// traité comme "problème" au même titre qu'un élément Reality Gate
// jamais mis à niveau, cohérent avec la discipline déjà établie pour
// reseau_fosse dans lib/reality-gate.ts). Décision de mapping explicite,
// pas un fait MLIT : documentée ici, pas dispersée.
export function parseSewageTerm(raw: string): RealityGateItemStatus | null {
  if (raw.includes("公共下水")) return "verifie";
  if (raw.includes("浄化槽")) return "verifie";
  if (raw.includes("汲み取り")) return "probleme";
  return null;
}

// 土地面積/敷地面積 (surface du terrain) et 建物面積/延床面積 (surface du
// bâtiment) partagent le même format numérique "XXX.XXm²" ou "XXX㎡" —
// un seul parseur, jamais deux implémentations parallèles pour la même
// syntaxe.
export function parseAreaM2(raw: string): number | null {
  const match = raw.match(/([\d,]+(?:\.\d+)?)\s*[m㎡]/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// 築年 / 築XX年 (âge du bâtiment) ou une année sur 4 chiffres directe —
// retourne l'année de construction, jamais devinée si absente.
export function parseBuildingYearTerm(raw: string, currentYear = new Date().getFullYear()): number | null {
  const directYear = raw.match(/(\d{4})年建築|^(\d{4})$/);
  if (directYear) return Number(directYear[1] ?? directYear[2]);

  const age = raw.match(/築\s*(\d+)\s*年/);
  if (age) return currentYear - Number(age[1]);

  return null;
}

// 空き家 (akiya / maison vacante) — un indicateur binaire simple, mais
// son absence dans un texte ne signifie PAS "non vacante" : seule sa
// présence explicite est un fait.
export function isMarkedAsAkiya(raw: string): boolean {
  return raw.includes("空き家");
}

// Prix : soit un montant en chiffres suivi de 円 ("3,000,000円"), soit
// la convention "X万円" (X dizaines de milliers de yens — "300万円" =
// 3 000 000 円). Les deux formats coexistent sur les sites municipaux ;
// jamais mélangés silencieusement, jamais une virgule de milliers prise
// pour un séparateur décimal.
export function parsePriceJpy(raw: string): number | null {
  const man = raw.match(/([\d,]+(?:\.\d+)?)\s*万\s*円/);
  if (man) {
    const value = Number(man[1].replace(/,/g, "")) * 10_000;
    return Number.isFinite(value) ? value : null;
  }

  const yen = raw.match(/^([\d,]+)\s*円?$/);
  if (yen) {
    const value = Number(yen[1].replace(/,/g, ""));
    return Number.isFinite(value) ? value : null;
  }

  return null;
}
