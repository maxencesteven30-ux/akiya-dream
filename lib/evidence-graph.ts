import { buildNextActionSignals, type NextActionInput, type PrioritizedAction } from "@/lib/next-best-action";
import type { CrossSourceContext } from "@/lib/cross-source-context";

// Phase AH — Evidence Graph / Decision Trace.
//
// N'invente aucune nouvelle logique de scoring : rend traçable ce que
// les moteurs existants (Reality Gate, Due Diligence, budget, Next Best
// Action...) ont déjà établi via buildNextActionSignals(), la source de
// vérité unique déjà utilisée par le Centre de décision, Ask My Project
// et Akiya Passport. Ce module ne fait qu'ENVELOPPER ces signaux dans
// une structure explicable : VERDICT → REASON → FACTS → SOURCE →
// ASSUMPTIONS → UNKNOWN → NEXT ACTION.

export type ProvenanceLabel = "FACT" | "ESTIMATE" | "USER_INPUT" | "UNKNOWN" | "EXTERNAL_FACT" | "DERIVED_VALUE";

export const PROVENANCE_LABELS: Record<ProvenanceLabel, string> = {
  FACT: "🟢 Fait vérifié",
  ESTIMATE: "🔵 Estimation",
  USER_INPUT: "⚪ Donnée utilisateur",
  UNKNOWN: "🟠 Inconnu",
  EXTERNAL_FACT: "🌐 Fait externe sourcé",
  DERIVED_VALUE: "🧮 Valeur calculée",
};

// Registre centralisé champ → provenance (section 16 de la mission :
// chaque donnée affichée dans une conclusion importante doit pouvoir
// être classée). Préfixes testés dans l'ordre ; le premier qui
// correspond gagne. Un champ non reconnu reste UNKNOWN — jamais une
// provenance devinée par défaut.
const FIELD_PROVENANCE_RULES: Array<[prefix: string, label: ProvenanceLabel]> = [
  ["realityGate.", "USER_INPUT"],
  ["dueDiligence.", "USER_INPUT"],
  ["landNature", "USER_INPUT"],
  ["documentsCount", "USER_INPUT"],
  ["history", "USER_INPUT"],
  ["completion.", "DERIVED_VALUE"],
  ["feasibility", "DERIVED_VALUE"],
  ["visitStatus", "DERIVED_VALUE"],
  ["budget.acquisitionJpy", "DERIVED_VALUE"],
  ["budget.maxAffordablePriceJpy", "DERIVED_VALUE"],
  ["budget.travauxJpy", "ESTIMATE"],
  ["budget.aidesJpy", "ESTIMATE"],
  ["riskFlags", "DERIVED_VALUE"],
  ["comparisonData", "DERIVED_VALUE"],
  ["fxRate", "EXTERNAL_FACT"],
  ["capitalDisponibleEur", "USER_INPUT"],
  ["reserveSecuriteEur", "USER_INPUT"],
  ["remoteOwner.", "USER_INPUT"],
  ["exitStrategy.", "USER_INPUT"],
  ["nextActionInput", "DERIVED_VALUE"],
  // AD.3 — Cross-Source Intelligence : les données brutes MLIT sont des
  // faits externes sourcés/datés ; tout ce qu'Akiya Dream en déduit
  // (dispersion, médiane, valeur foncière implicite) reste une valeur
  // calculée, jamais un fait externe.
  ["mlitTransactions", "EXTERNAL_FACT"],
  ["landPricePoints", "EXTERNAL_FACT"],
  ["marketComparison", "DERIVED_VALUE"],
  ["impliedLandValueJpy", "DERIVED_VALUE"],
  ["medianLandPricePerSqmJpy", "DERIVED_VALUE"],
  ["askingPriceJpy", "USER_INPUT"],
  ["landM2", "USER_INPUT"],
];

export function classifyFieldProvenance(fieldPath: string): ProvenanceLabel {
  const rule = FIELD_PROVENANCE_RULES.find(([prefix]) => fieldPath.startsWith(prefix));
  return rule ? rule[1] : "UNKNOWN";
}

export interface EvidenceFact {
  fieldPath: string;
  provenance: ProvenanceLabel;
}

export interface EvidenceNode {
  verdict: string;
  reasonMessage: string;
  ruleId: string;
  facts: EvidenceFact[];
  unknownFields: string[];
  nextAction: string;
}

// Enveloppe un seul signal (déjà calculé par lib/next-best-action.ts)
// dans une structure explicable — aucun recalcul, uniquement de la mise
// en forme et de la classification de provenance.
export function explainSignal(signal: PrioritizedAction): EvidenceNode {
  const facts = signal.reason.fieldsUsed.map((fieldPath) => ({
    fieldPath,
    provenance: classifyFieldProvenance(fieldPath),
  }));

  return {
    verdict: signal.level,
    reasonMessage: signal.reason.message,
    ruleId: signal.reason.ruleId,
    facts,
    unknownFields: facts.filter((f) => f.provenance === "UNKNOWN").map((f) => f.fieldPath),
    nextAction: signal.message,
  };
}

// Le graphe complet : un nœud explicable par signal actif, dans le même
// ordre de priorité que Next Best Action (BLOCKING > CRITICAL_UNKNOWN >
// DOCUMENTED_RISK > MISSING_INFO > OPTIMIZATION). Répond à "pourquoi
// Akiya Dream me recommande cela ?" pour chaque point, pas seulement le
// premier.
export function computeEvidenceGraph(input: NextActionInput): EvidenceNode[] {
  return buildNextActionSignals(input).map(explainSignal);
}

// AD.3.4 — trace le croisement des sources (transactions + prix foncier
// officiel) selon la même structure VERDICT → REASON → FACTS →
// PROVENANCE, sans dupliquer la logique de lib/cross-source-context.ts
// ni celle de Next Best Action : un nœud distinct pour un domaine de
// faits distinct (données de marché), jamais mélangé aux signaux
// Reality Gate/Due Diligence.
export function explainCrossSourceContext(context: CrossSourceContext): EvidenceNode {
  const fieldsUsed = ["askingPriceJpy"];
  if (context.transactionsAvailable) fieldsUsed.push("mlitTransactions", "marketComparison");
  if (context.landPriceAvailable) {
    fieldsUsed.push("landPricePoints", "medianLandPricePerSqmJpy");
    if (context.impliedLandValueJpy !== null) {
      fieldsUsed.push("landM2", "impliedLandValueJpy");
    }
  }

  const facts = fieldsUsed.map((fieldPath) => ({ fieldPath, provenance: classifyFieldProvenance(fieldPath) }));

  return {
    verdict: context.concordance,
    reasonMessage: context.narrative[0] ?? "Données insuffisantes pour croiser les sources.",
    ruleId: "cross_source_concordance",
    facts,
    unknownFields: context.unknowns,
    nextAction: context.narrative[context.narrative.length - 1] ?? "",
  };
}
