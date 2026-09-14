// Era 9 (suite) — Population Projection Mesh (XKT013, 国土数値情報
// 「将来推計人口メッシュ」250m). Schéma vérifié via la documentation
// officielle de l'endpoint (pas seulement la page de synthèse) le
// 2026-09-14 :
//   - PT00_20XX = "20XX年男女計総数人口" (population totale, les deux
//     sexes, année 20XX) — nombre réel, peut être fractionnaire (c'est
//     une estimation modélisée, pas un recensement brut).
//   - RTD_20XX = "20XX年男女計75歳以上人口比率" (ratio de la population
//     de 75 ans et plus, année 20XX).
//   - HITOKU20XX = "20XX年秘匿記号" (symbole de confidentialité) — une
//     valeur non vide signale une donnée supprimée pour cette année ;
//     jamais présentée comme un fait dans ce cas, quelle que soit la
//     valeur numérique par ailleurs présente dans PT00/RTD.

export interface PopulationYearPoint {
  year: number;
  totalPopulation: number | null;
  elderlyRatio75Plus: number | null;
  // true si HITOKU{year} porte un symbole de confidentialité — les deux
  // champs ci-dessus restent alors null même si l'API a renvoyé une
  // valeur numérique brute pour cette année.
  suppressed: boolean;
}

const TOTAL_POPULATION_FIELD = /^PT00_(\d{4})$/;

function parseNumericField(properties: Record<string, unknown>, key: string): number | null {
  const value = properties[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isSuppressed(properties: Record<string, unknown>, year: number): boolean {
  const symbol = properties[`HITOKU${year}`];
  return typeof symbol === "string" && symbol.trim() !== "";
}

// Une feature du mesh 250m couvre plusieurs années par cellule — jamais
// deux implémentations parallèles pour lire PT00/RTD/HITOKU, un seul
// parseur ici.
export function parsePopulationMeshFeature(properties: Record<string, unknown>): PopulationYearPoint[] {
  const years = Object.keys(properties)
    .map((key) => key.match(TOTAL_POPULATION_FIELD))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);

  return years.map((year) => {
    const suppressed = isSuppressed(properties, year);
    return {
      year,
      totalPopulation: suppressed ? null : parseNumericField(properties, `PT00_${year}`),
      elderlyRatio75Plus: suppressed ? null : parseNumericField(properties, `RTD_${year}`),
      suppressed,
    };
  });
}
