import type { MlitTransaction } from "@/lib/mlit/types";

// Agrégation du prix moyen réel au m² à partir de transactions XIT001
// déjà récupérées (lib/mlit/provider.ts) — jamais une deuxième source,
// juste une moyenne calculée sur des transactions réelles individuelles.
//
// Surface retenue : la surface de plancher totale (totalFloorAreaM2)
// quand disponible (transaction bâtiment), sinon la surface de terrain
// (areaM2, transaction terrain seul) — jamais les deux additionnées, et
// une transaction sans aucune des deux est exclue plutôt que comptée
// avec une surface devinée.
export interface AveragePricePerSqm {
  averagePricePerSqmJpy: number;
  sampleSize: number;
}

export function computeAveragePricePerSqm(transactions: MlitTransaction[]): AveragePricePerSqm | null {
  const samples: number[] = [];
  for (const t of transactions) {
    const area = t.totalFloorAreaM2 ?? t.areaM2;
    if (area != null && area > 0 && t.tradePriceJpy > 0) {
      samples.push(t.tradePriceJpy / area);
    }
  }

  if (samples.length === 0) return null;

  const average = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  return { averagePricePerSqmJpy: Math.round(average), sampleSize: samples.length };
}

// Les 4 trimestres réels les plus récents à interroger, en partant de 2
// trimestres avant le trimestre courant — les transactions immobilières
// MLIT sont publiées avec un décalage documenté (jamais le trimestre en
// cours), donc interroger le trimestre courant renverrait
// systématiquement un résultat vide plutôt qu'une vraie absence de
// données. Un décalage de 2 trimestres est une hypothèse de fraîcheur
// raisonnable, pas une garantie de disponibilité : chaque trimestre est
// interrogé indépendamment et les absences (NOT_FOUND) sont normales.
export interface YearQuarter {
  year: number;
  quarter: 1 | 2 | 3 | 4;
}

export function recentQuarters(referenceDate: Date, count: number): YearQuarter[] {
  const currentQuarter = (Math.floor(referenceDate.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  let year = referenceDate.getFullYear();
  let quarter = currentQuarter;

  // Recule de 2 trimestres pour partir d'un trimestre déjà publié.
  for (let i = 0; i < 2; i++) {
    quarter = quarter === 1 ? 4 : ((quarter - 1) as 1 | 2 | 3 | 4);
    if (quarter === 4) year -= 1;
  }

  const result: YearQuarter[] = [];
  for (let i = 0; i < count; i++) {
    result.push({ year, quarter });
    quarter = quarter === 1 ? 4 : ((quarter - 1) as 1 | 2 | 3 | 4);
    if (quarter === 4) year -= 1;
  }
  return result;
}
