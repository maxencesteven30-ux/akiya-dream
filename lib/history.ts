import type { HistoryEntry } from "@/lib/types";

// Phase P — Historique des hypothèses.
//
// Un "point d'étape" est un instantané volontaire, déclenché par
// l'utilisateur (jamais automatique), des hypothèses clés du projet à un
// instant donné : prix, travaux estimés, taux de change utilisé, et note
// d'opportunité si elle a déjà été calculée. Objectif : une vraie
// traçabilité ("qu'est-ce qui a changé depuis la dernière fois ?"), pas un
// journal technique.

export interface NewHistoryEntryInput {
  housePriceJpy: number;
  travauxJpy: number;
  totalProjetJpy: number;
  eurJpyRate: number;
  opportunityScore: number | null;
  isPostVisit?: boolean;
}

export function createHistoryEntry(
  input: NewHistoryEntryInput,
  now: Date = new Date(),
): HistoryEntry {
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now.toISOString(),
    housePriceJpy: input.housePriceJpy,
    travauxJpy: input.travauxJpy,
    totalProjetJpy: input.totalProjetJpy,
    eurJpyRate: input.eurJpyRate,
    opportunityScore: input.opportunityScore,
    isPostVisit: input.isPostVisit ?? false,
  };
}

export interface HistoryEntryWithDiff {
  entry: HistoryEntry;
  previous: HistoryEntry | null;
  priceDeltaJpy: number | null;
  travauxDeltaJpy: number | null;
  scoreDelta: number | null;
}

// `entries` doit être trié du plus ancien au plus récent (ordre
// d'enregistrement). Chaque élément est comparé au précédent, jamais au
// tout premier : on veut voir l'évolution pas à pas, pas seulement le
// cumul depuis le début.
export function computeHistoryDiffs(entries: HistoryEntry[]): HistoryEntryWithDiff[] {
  return entries.map((entry, index) => {
    const previous = index > 0 ? entries[index - 1] : null;
    return {
      entry,
      previous,
      priceDeltaJpy: previous ? entry.housePriceJpy - previous.housePriceJpy : null,
      travauxDeltaJpy: previous ? entry.travauxJpy - previous.travauxJpy : null,
      scoreDelta:
        previous && previous.opportunityScore !== null && entry.opportunityScore !== null
          ? entry.opportunityScore - previous.opportunityScore
          : null,
    };
  });
}

// Phase R — Avant / Après visite.
//
// Réutilise l'historique de la Phase P plutôt qu'un mécanisme séparé :
// une visite se traduit simplement par un point d'étape marqué
// `isPostVisit`, comparé à celui qui le précède immédiatement dans le
// temps (les hypothèses juste avant la visite). S'il n'y a pas de point
// d'étape avant (la toute première visite est aussi le tout premier point
// d'étape), aucune comparaison n'a de sens : retourne null.
export interface VisitComparison {
  before: HistoryEntry;
  after: HistoryEntry;
}

export function findVisitComparison(entries: HistoryEntry[]): VisitComparison | null {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].isPostVisit && i > 0) {
      return { before: entries[i - 1], after: entries[i] };
    }
  }
  return null;
}
