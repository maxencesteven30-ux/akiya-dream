// Fondation épistémique partagée par Reality Gate, Decision Center et le
// futur moteur Question Intelligence : toute donnée affichée doit pouvoir
// dire d'où elle vient, et toute recommandation doit pouvoir dire pourquoi.
//
// Règle absolue (rappelée par le CSV "Question Intelligence Engine") :
// "unknown" ne se convertit jamais implicitement en une valeur favorable
// (yes/safe/good/legal/no_risk). Les fonctions de ce fichier n'offrent
// aucun chemin pour le faire — un "unknown" reste un "unknown" jusqu'à ce
// qu'une source (utilisateur, professionnel, autorité) le remplace.

export type DataOrigin = "fact" | "estimate" | "user_input" | "unknown";

export const DATA_ORIGIN_LABELS: Record<DataOrigin, string> = {
  fact: "🟢 Fait vérifié",
  estimate: "🔵 Estimation",
  user_input: "⚪ Donnée utilisateur",
  unknown: "🟠 Inconnu",
};

// Traçabilité : chaque recommandation doit pouvoir répondre à "pourquoi ?"
// avec la règle appliquée et les champs réellement utilisés — jamais une
// boîte noire.
export interface Reason {
  ruleId: string;
  message: string;
  fieldsUsed: string[];
}

// Hiérarchie de priorité fixe (BLOCKING > CRITICAL_UNKNOWN > DOCUMENTED_RISK
// > MISSING_INFO > OPTIMIZATION), commune au Next Best Action Engine et au
// Question Intelligence Engine.
export type SignalLevel =
  | "BLOCKING"
  | "CRITICAL_UNKNOWN"
  | "DOCUMENTED_RISK"
  | "MISSING_INFO"
  | "OPTIMIZATION";

export const SIGNAL_LEVEL_LABELS: Record<SignalLevel, string> = {
  BLOCKING: "🔴 Problème bloquant avéré",
  CRITICAL_UNKNOWN: "🟠 Information critique inconnue",
  DOCUMENTED_RISK: "⚠️ Risque documenté",
  MISSING_INFO: "📋 Information importante manquante",
  OPTIMIZATION: "🎯 Optimisation",
};

// Ordre de priorité explicite : index le plus bas = priorité la plus haute.
// Un tableau fixe plutôt qu'un score, pour rester un classement de règles
// et non un apprentissage.
export const SIGNAL_LEVEL_PRIORITY: SignalLevel[] = [
  "BLOCKING",
  "CRITICAL_UNKNOWN",
  "DOCUMENTED_RISK",
  "MISSING_INFO",
  "OPTIMIZATION",
];

export interface Signal {
  level: SignalLevel;
  reason: Reason;
}

// Tri stable par priorité : à niveau égal, l'ordre d'arrivée est conservé
// (les moteurs appelants injectent déjà leurs signaux dans un ordre
// significatif au sein d'un même niveau).
export function sortSignalsByPriority<T extends Signal>(signals: T[]): T[] {
  return [...signals].sort(
    (a, b) => SIGNAL_LEVEL_PRIORITY.indexOf(a.level) - SIGNAL_LEVEL_PRIORITY.indexOf(b.level),
  );
}
