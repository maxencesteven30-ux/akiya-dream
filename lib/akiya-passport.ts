import { REALITY_GATE_TEMPLATE } from "@/lib/reality-gate";
import { buildNextActionSignals, type NextActionInput } from "@/lib/next-best-action";
import { OPPORTUNITY_CATEGORY_LABELS, FEASIBILITY_LABELS, type OpportunityCategory } from "@/lib/opportunity";
import type { FeasibilityLevel } from "@/lib/opportunity";
import type { CrossSourceContext } from "@/lib/cross-source-context";

// Phase Z — Akiya Passport.
//
// L'objectif final de tout Akiya Dream : ne jamais dire simplement "cette
// maison est bonne", mais toujours pouvoir dire "voici ce qui est connu /
// estimé / inconnu / potentiellement bloquant / la prochaine information
// la plus importante à obtenir." Ce module n'introduit aucune nouvelle
// donnée ni aucun nouveau calcul de risque : il synthétise uniquement ce
// que les moteurs existants (Reality Gate, Due Diligence, Next Best
// Action) ont déjà établi.

export interface AkiyaPassportInput {
  propertyName: string;
  opportunityScore: number;
  opportunityCategory: OpportunityCategory;
  feasibility: FeasibilityLevel | null;
  budget: {
    totalProjetJpy: number;
    travauxJpy: number;
    acquisitionJpy: number;
  };
  nextActionInput: NextActionInput;
  // AD.3.5 — optionnel : présent seulement si une consultation MLIT a eu
  // lieu dans la session (rafraîchissement manuel, comme FX/Market
  // Context). Enrichit le Passport, ne le remplace jamais.
  crossSourceContext?: CrossSourceContext | null;
}

export interface AkiyaPassportSummary {
  propertyName: string;
  known: string[];
  estimated: string[];
  unknown: string[];
  potentiallyBlocking: string[];
  nextMostImportantInfo: string;
}

export function computeAkiyaPassport(input: AkiyaPassportInput): AkiyaPassportSummary {
  const { realityGate, completion } = input.nextActionInput;
  const verifiedRealityGateCount = REALITY_GATE_TEMPLATE.filter(
    (item) => realityGate[item.id] === "verifie",
  ).length;

  const known: string[] = [
    `${verifiedRealityGateCount}/${REALITY_GATE_TEMPLATE.length} éléments du Property Reality Gate vérifiés`,
    `${completion.completed}/${completion.total} éléments de due diligence vérifiés`,
    `Frais d'acquisition (barème légal) : ${input.budget.acquisitionJpy.toLocaleString("fr-FR")} JPY`,
  ];

  const estimated: string[] = [
    `Note d'opportunité : ${input.opportunityScore.toFixed(1)}/10 (${OPPORTUNITY_CATEGORY_LABELS[input.opportunityCategory]})`,
    `Travaux estimés : ${input.budget.travauxJpy.toLocaleString("fr-FR")} JPY (hypothèse de niveau, pas un devis)`,
  ];
  if (input.feasibility) {
    estimated.push(`Faisabilité budgétaire : ${FEASIBILITY_LABELS[input.feasibility]}`);
  }

  const signals = buildNextActionSignals(input.nextActionInput);
  const potentiallyBlocking = signals.filter((s) => s.level === "BLOCKING").map((s) => s.reason.message);
  const unknown = signals
    .filter((s) => s.level === "CRITICAL_UNKNOWN" || s.level === "MISSING_INFO")
    .map((s) => s.reason.message);

  const nextMostImportantInfo = signals[0]?.message ?? "Projet prêt pour une offre.";

  // AD.3.5 — jamais une recommandation catégorique : les données
  // croisées enrichissent connu/estimé/inconnu comme le reste, ne créent
  // jamais un blocage ni ne remplacent nextMostImportantInfo (qui reste
  // piloté uniquement par Reality Gate/Due Diligence, cf. Next Best
  // Action Engine).
  if (input.crossSourceContext) {
    const ctx = input.crossSourceContext;
    if (ctx.transactionsAvailable) known.push("Transactions comparables MLIT disponibles (source externe datée)");
    if (ctx.landPriceAvailable) known.push("Prix foncier officiel MLIT disponible (source externe datée)");
    if (ctx.impliedLandValueJpy !== null) {
      estimated.push(`Valeur foncière implicite (calculée) : ${ctx.impliedLandValueJpy.toLocaleString("fr-FR")} JPY`);
    }
    unknown.push(...ctx.unknowns);
  }

  return {
    propertyName: input.propertyName,
    known,
    estimated,
    unknown,
    potentiallyBlocking,
    nextMostImportantInfo,
  };
}
