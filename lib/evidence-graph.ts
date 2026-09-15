import { buildNextActionSignals, type NextActionInput, type PrioritizedAction } from "@/lib/next-best-action";
import type { CrossSourceContext } from "@/lib/cross-source-context";
import type { DiscoveryResultItem } from "@/lib/discovery/discovery-orchestrator";

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
  // Era 9 (suite) — un champ d'un PropertyListing découvert vient
  // toujours d'une source externe (annonce, registre) jamais vérifiée
  // par Akiya Dream elle-même — distinct d'un EXTERNAL_FACT MLIT/e-Stat
  // (source officielle gouvernementale) précisément parce que sa
  // fiabilité n'est pas garantie de la même façon ; conservé sous le
  // même label faute d'un niveau de confiance dédié pour l'instant.
  ["listing.", "EXTERNAL_FACT"],
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

// Era 9 (suite) — Discovery Engine : "pourquoi ce bien ?" (section 27 de
// la mission). Enveloppe exactement ce que evaluateHardConstraints (AJ)
// et scoreSoftPreferences (AK) ont déjà établi, sur le même modèle que
// explainCrossSourceContext ci-dessus — aucun recalcul, aucun moteur
// explicatif parallèle. Seuls les critères ACTIFS (NOT_APPLICABLE / not_active
// exclus) apparaissent : un critère jamais demandé par l'utilisateur n'est
// ni un fait ni une inconnue pertinente ici.
export function explainListingEvaluation(item: DiscoveryResultItem): EvidenceNode {
  const activeHardChecks = item.hardConstraintEvaluation.checks.filter((c) => c.status !== "NOT_APPLICABLE");
  const activeSoftMatches = item.softPreferenceScore.matches.filter((m) => m.status !== "not_active");

  const facts: EvidenceFact[] = [
    ...activeHardChecks.map((c) => ({
      fieldPath: `listing.${c.criterionId}`,
      provenance: classifyFieldProvenance(`listing.${c.criterionId}`),
    })),
    ...activeSoftMatches.map((m) => ({
      fieldPath: `listing.${m.criterionId}`,
      provenance: classifyFieldProvenance(`listing.${m.criterionId}`),
    })),
  ];

  const unknownFields = [
    ...activeHardChecks.filter((c) => c.status === "UNKNOWN").map((c) => `listing.${c.criterionId}`),
    ...activeSoftMatches.filter((m) => m.status === "unknown").map((m) => `listing.${m.criterionId}`),
  ];

  const passedHard = activeHardChecks.filter((c) => c.status === "PASS").map((c) => c.label);
  const failedHard = activeHardChecks.filter((c) => c.status === "FAIL").map((c) => c.label);
  const matchedSoft = activeSoftMatches.filter((m) => m.status === "matched").map((m) => m.label);
  const unmatchedSoft = activeSoftMatches.filter((m) => m.status === "unmatched").map((m) => m.label);

  const reasonParts: string[] = [];
  if (passedHard.length > 0) reasonParts.push(`Critères éliminatoires respectés : ${passedHard.join(", ")}.`);
  if (failedHard.length > 0) reasonParts.push(`Critères éliminatoires non respectés : ${failedHard.join(", ")}.`);
  if (matchedSoft.length > 0) reasonParts.push(`Préférences satisfaites : ${matchedSoft.join(", ")}.`);
  if (unmatchedSoft.length > 0) reasonParts.push(`Préférences non satisfaites : ${unmatchedSoft.join(", ")}.`);
  if (reasonParts.length === 0) reasonParts.push("Aucun critère actif à évaluer pour ce bien.");

  const nextAction =
    unknownFields.length > 0
      ? `À vérifier avant toute décision : ${unknownFields.map((f) => f.replace("listing.", "")).join(", ")}.`
      : item.hardConstraintEvaluation.verdict === "FAIL"
        ? "Ce bien ne correspond pas à un ou plusieurs critères éliminatoires de votre projet."
        : "Aucune vérification supplémentaire requise pour la correspondance à votre profil de recherche.";

  return {
    verdict: item.hardConstraintEvaluation.verdict,
    reasonMessage: reasonParts.join(" "),
    ruleId: "discovery_listing_match",
    facts,
    unknownFields,
    nextAction,
  };
}
