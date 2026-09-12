import type { PrioritizedAction } from "@/lib/next-best-action";
import type { SignalLevel } from "@/lib/data-origin";

// "Qu'est-ce qui pourrait changer mon verdict ?" — sélectionne, parmi les
// signaux déjà produits par le Next Best Action Engine (déjà triés par
// priorité BLOCKING > CRITICAL_UNKNOWN > DOCUMENTED_RISK > MISSING_INFO >
// OPTIMIZATION), les 1 à 3 informations dont la résolution a le plus de
// chances de faire évoluer le verdict actuel.
//
// N'invente aucune probabilité : le classement est exactement celui du
// moteur de signaux (aucun score ni pondération supplémentaire), et le
// "pourquoi" est un texte fixe par niveau, jamais une estimation d'impact
// chiffrée.

export interface MindChangingFactor {
  rank: 1 | 2 | 3;
  level: SignalLevel;
  action: string;
  why: string;
}

const WHY_TEMPLATES: Record<SignalLevel, (reasonMessage: string) => string> = {
  BLOCKING: (r) =>
    `Ce point bloque actuellement toute avancée du projet, quelle que soit la note d'opportunité (${r}).`,
  CRITICAL_UNKNOWN: (r) =>
    `Cette information critique est aujourd'hui inconnue et empêche un verdict favorable tant qu'elle n'est pas vérifiée (${r}).`,
  DOCUMENTED_RISK: (r) => `Ce risque est documenté et peut peser sur le coût ou la faisabilité (${r}).`,
  MISSING_INFO: (r) => `Cette information manquante limite la fiabilité du dossier actuel (${r}).`,
  OPTIMIZATION: (r) => `Cette optimisation pourrait améliorer le projet sans lever de blocage (${r}).`,
};

const MAX_FACTORS = 3;

export function computeWhatWouldChangeMyMind(signals: PrioritizedAction[]): MindChangingFactor[] {
  return signals.slice(0, MAX_FACTORS).map((signal, index) => ({
    rank: (index + 1) as 1 | 2 | 3,
    level: signal.level,
    action: signal.message,
    why: WHY_TEMPLATES[signal.level](signal.reason.message),
  }));
}
