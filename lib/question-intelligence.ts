import type { Reason } from "@/lib/data-origin";
import { buildNextActionSignals, type NextActionInput, type PrioritizedAction } from "@/lib/next-best-action";
import { computeWhatWouldChangeMyMind } from "@/lib/what-would-change-my-mind";
import { FEASIBILITY_LABELS, OPPORTUNITY_CATEGORY_LABELS, type OpportunityCategory } from "@/lib/opportunity";
import {
  RECONSTRUCTION_ITEM_ID,
  REALITY_GATE_PROBLEM_ACTIONS,
  REALITY_GATE_STATUS_LABELS,
  REALITY_GATE_TEMPLATE,
} from "@/lib/reality-gate";
import type { RealityGateItemStatus } from "@/lib/types";

// Question Intelligence Engine — dispatcher fixe (aucun NLP, aucune IA
// générative) qui relie 70 questions réelles d'acheteurs à des règles
// déterministes et aux moteurs déjà existants de l'application.
//
// QUESTION → INTENTION → RÈGLE DÉTERMINISTE → DONNÉES DISPONIBLES →
// DONNÉES MANQUANTES → PRIORITÉ → RÉPONSE EXPLICABLE
//
// Chaque question est classée une fois pour toutes (ÉTAPE 2 de l'audit) :
//   A — déjà supportée par un moteur existant
//   B — partiellement supportée, complétée ici par une règle explicite
//   C — donnée manquante côté projet : réponse honnête, jamais inventée
//   D — nécessite une source officielle non intégrée (MLIT, registre...)
//   E — ne doit jamais être automatisée : orientation professionnelle
//
// computeQuestionAnswer() n'est câblé (ÉTAPE 3) que pour les clusters
// C/D/E (génériques, sans risque) et pour les questions "signature"
// explicitement citées par la demande (Q02, Q38, Q39, Q40, Q41, Q42, Q43,
// Q45, Q61, Q62). Le reste du cluster A/B reste répertorié (mapping
// complet, aucune question absente de l'audit) mais retourne `null` tant
// qu'il n'est pas relié à un moteur — jamais une réponse à moitié
// fabriquée pour "faire du chiffre".

export type QuestionCluster = "A" | "B" | "C" | "D" | "E";

export type ProfessionalRoute = "mairie" | "juriste" | "professionnel_batiment" | "arpenteur" | "entrepreneur";

export const PROFESSIONAL_ROUTE_LABELS: Record<ProfessionalRoute, string> = {
  mairie: "la municipalité (mairie)",
  juriste: "un juriste / shihō shoshi",
  professionnel_batiment: "un professionnel du bâtiment (inspecteur, artisan agréé)",
  arpenteur: "un géomètre / arpenteur",
  entrepreneur: "un entrepreneur (devis)",
};

export interface QuestionDef {
  id: string;
  questionFr: string;
  domain: string;
  engine: string;
  cluster: QuestionCluster;
  requiredEvidence: string;
  hardGuardrail: string;
  // Renseigné uniquement pour le cluster E.
  routeTo?: ProfessionalRoute;
}

export const QUESTION_REGISTRY: QuestionDef[] = [
  { id: "Q01", questionFr: "Pourquoi cette akiya est-elle si peu chère ?", domain: "market", engine: "PRICE", cluster: "C", requiredEvidence: "transactions comparables (MLIT reinfolib)", hardGuardrail: "Prix atypique ≠ bonne affaire" },
  { id: "Q02", questionFr: "Est-ce vraiment une bonne affaire ?", domain: "decision", engine: "DECISION", cluster: "B", requiredEvidence: "opportunity_score + feasibility_verdict + blocking_issue + due_diligence_completion", hardGuardrail: "Bonne affaire seulement si aucun fait critique contraire" },
  { id: "Q03", questionFr: "Puis-je reconstruire la maison ?", domain: "legal", engine: "LEGAL", cluster: "A", requiredEvidence: "rebuild_status (Reality Gate)", hardGuardrail: "Ne jamais inférer depuis le prix ou une photo" },
  { id: "Q04", questionFr: "La route visible donne-t-elle un droit d'accès ?", domain: "legal", engine: "LEGAL", cluster: "A", requiredEvidence: "road_access_status + easement_access_status (Reality Gate)", hardGuardrail: "Carte seule insuffisante" },
  { id: "Q05", questionFr: "Puis-je vivre ici toute l'année ?", domain: "utilities", engine: "LIVABILITY", cluster: "A", requiredEvidence: "statuts réseaux (Reality Gate)", hardGuardrail: "Ne pas confondre raccordement théorique et fonctionnement réel" },
  { id: "Q06", questionFr: "Combien vais-je vraiment payer au total ?", domain: "finance", engine: "FINANCE", cluster: "A", requiredEvidence: "budget (acquisition + travaux + coût annuel)", hardGuardrail: "Pas de double comptage" },
  { id: "Q07", questionFr: "Le prix affiché est-il négociable ?", domain: "market", engine: "NEGOTIATION", cluster: "C", requiredEvidence: "transactions comparables + zone", hardGuardrail: "Pas de promesse que le vendeur acceptera" },
  { id: "Q08", questionFr: "Quel prix maximum puis-je payer ?", domain: "finance", engine: "FINANCE", cluster: "A", requiredEvidence: "budget disponible + réserve", hardGuardrail: "Le plafond n'est pas une valeur de marché" },
  { id: "Q09", questionFr: "Les termites peuvent-ils ruiner le projet ?", domain: "inspection", engine: "BUILDING", cluster: "E", requiredEvidence: "diagnostic termites professionnel", hardGuardrail: "Pas de diagnostic à partir d'une seule photo", routeTo: "professionnel_batiment" },
  { id: "Q10", questionFr: "Le toit est-il un problème ?", domain: "inspection", engine: "BUILDING", cluster: "E", requiredEvidence: "devis + inspection professionnelle", hardGuardrail: "Pas d'estimation technique déguisée en expertise", routeTo: "professionnel_batiment" },
  { id: "Q11", questionFr: "L'humidité et la moisissure sont-elles graves ?", domain: "inspection", engine: "BUILDING", cluster: "E", requiredEvidence: "inspection professionnelle", hardGuardrail: "Ne pas conclure structure pourrie sans preuve", routeTo: "professionnel_batiment" },
  { id: "Q12", questionFr: "Le plancher affaissé est-il structurel ?", domain: "inspection", engine: "BUILDING", cluster: "E", requiredEvidence: "avis professionnel", hardGuardrail: "Observation ≠ diagnostic", routeTo: "professionnel_batiment" },
  { id: "Q13", questionFr: "L'électricité doit-elle être refaite ?", domain: "utilities", engine: "BUILDING", cluster: "A", requiredEvidence: "electricity_status (Reality Gate)", hardGuardrail: "Ne pas certifier conformité" },
  { id: "Q14", questionFr: "La plomberie fonctionne-t-elle ?", domain: "utilities", engine: "BUILDING", cluster: "A", requiredEvidence: "water_status + sewage_status (Reality Gate)", hardGuardrail: "Pas de conclusion sans test" },
  { id: "Q15", questionFr: "La fosse septique va-t-elle coûter cher ?", domain: "utilities", engine: "UTILITIES", cluster: "A", requiredEvidence: "jokaso_status (Reality Gate)", hardGuardrail: "Coût local uniquement avec source locale/devis" },
  { id: "Q16", questionFr: "Y a-t-il internet fiable ?", domain: "utilities", engine: "REMOTE_LIFE", cluster: "A", requiredEvidence: "internet_status (Reality Gate)", hardGuardrail: "Ne pas promettre de débit sans source" },
  { id: "Q17", questionFr: "La maison est-elle dangereuse en cas de séisme ?", domain: "hazards", engine: "HAZARD", cluster: "D", requiredEvidence: "J-SHIS (source officielle)", hardGuardrail: "Pas de prédiction de dommages" },
  { id: "Q18", questionFr: "La maison est-elle en zone inondable ?", domain: "hazards", engine: "HAZARD", cluster: "D", requiredEvidence: "MLIT National Land Numerical Information (GIS)", hardGuardrail: "Hors zone ≠ risque zéro" },
  { id: "Q19", questionFr: "Y a-t-il un risque de glissement de terrain ?", domain: "hazards", engine: "HAZARD", cluster: "D", requiredEvidence: "MLIT National Land Numerical Information (GIS)", hardGuardrail: "Pas de déduction depuis une pente visuelle" },
  { id: "Q20", questionFr: "Le tsunami est-il pertinent ici ?", domain: "hazards", engine: "HAZARD", cluster: "D", requiredEvidence: "MLIT National Land Numerical Information (GIS)", hardGuardrail: "Ne pas afficher 'sans risque' sans source" },
  { id: "Q21", questionFr: "Le terrain est-il à moi avec la maison ?", domain: "legal", engine: "LEGAL", cluster: "A", requiredEvidence: "propriete_titre (Reality Gate)", hardGuardrail: "Jamais supposer la pleine propriété" },
  { id: "Q22", questionFr: "Y a-t-il des héritiers ou un problème de succession ?", domain: "legal", engine: "LEGAL", cluster: "A", requiredEvidence: "propriete_hypotheques (Reality Gate)", hardGuardrail: "Ne pas diagnostiquer un dossier successoral" },
  { id: "Q23", questionFr: "Puis-je acheter en tant qu'étranger ?", domain: "process", engine: "PROCESS", cluster: "A", requiredEvidence: "aucune restriction de nationalité à l'achat (règle générale)", hardGuardrail: "Ne jamais présenter l'achat comme donnant un visa" },
  { id: "Q24", questionFr: "Acheter la maison me donne-t-il le droit de vivre au Japon ?", domain: "process", engine: "PROCESS", cluster: "A", requiredEvidence: "disclaimer visa/séjour", hardGuardrail: "Pas de conseil migratoire personnalisé sans source" },
  { id: "Q25", questionFr: "Puis-je utiliser la maison comme résidence secondaire ?", domain: "remote_owner", engine: "LOCAL_LIFE", cluster: "A", requiredEvidence: "occupancy_pattern (Remote Owner)", hardGuardrail: "Ne pas appliquer une règle d'une autre commune" },
  { id: "Q26", questionFr: "Puis-je la louer quand je n'y suis pas ?", domain: "exit", engine: "REGULATION", cluster: "A", requiredEvidence: "exit_strategy (location)", hardGuardrail: "Pas de rendement automatique sans hypothèses" },
  { id: "Q27", questionFr: "Puis-je faire du minpaku/Airbnb ?", domain: "exit", engine: "REGULATION", cluster: "A", requiredEvidence: "minpaku_intent + checklist minpaku", hardGuardrail: "Ne jamais conclure autorisé par défaut" },
  { id: "Q28", questionFr: "Combien de temps dureront les travaux ?", domain: "building", engine: "PROJECT", cluster: "E", requiredEvidence: "devis entrepreneur", hardGuardrail: "Devis/entreprise prime sur estimation", routeTo: "entrepreneur" },
  { id: "Q29", questionFr: "Puis-je faire les travaux moi-même ?", domain: "building", engine: "PROJECT", cluster: "E", requiredEvidence: "réglementation locale + type de travaux", hardGuardrail: "Pas de conseil légal non sourcé", routeTo: "mairie" },
  { id: "Q30", questionFr: "Les subventions vont-elles réduire mon coût ?", domain: "subsidies", engine: "FINANCE", cluster: "A", requiredEvidence: "eligible_subsidy_programs (sourcés)", hardGuardrail: "Ne jamais déduire une aide du budget comme acquise" },
  { id: "Q31", questionFr: "Les aides doivent-elles être demandées avant les travaux ?", domain: "subsidies", engine: "PROCESS", cluster: "A", requiredEvidence: "règles des programmes de subvention", hardGuardrail: "Ne pas supposer la rétroactivité" },
  { id: "Q32", questionFr: "Que se passe-t-il si je commence les travaux trop tôt ?", domain: "subsidies", engine: "PROCESS", cluster: "A", requiredEvidence: "règles du programme concerné", hardGuardrail: "Pas de généralisation universelle" },
  { id: "Q33", questionFr: "Y a-t-il des frais cachés après l'achat ?", domain: "finance", engine: "FINANCE", cluster: "C", requiredEvidence: "postes de coûts locaux non encore documentés", hardGuardrail: "Ne pas inventer de montant local" },
  { id: "Q34", questionFr: "Dois-je prévoir une réserve d'urgence ?", domain: "finance", engine: "FINANCE", cluster: "A", requiredEvidence: "available_capital_eur + safety_reserve_eur", hardGuardrail: "Ne pas fixer une réserve universelle arbitraire" },
  { id: "Q35", questionFr: "Que dois-je vérifier avant de faire une offre ?", domain: "workflow", engine: "WORKFLOW", cluster: "B", requiredEvidence: "due_diligence_completion + inconnues critiques", hardGuardrail: "Ne pas exiger tous les items si non applicables" },
  { id: "Q36", questionFr: "Que dois-je vérifier pendant la visite ?", domain: "workflow", engine: "WORKFLOW", cluster: "A", requiredEvidence: "visit_checklist", hardGuardrail: "Pas de faux diagnostic" },
  { id: "Q37", questionFr: "Quelles photos dois-je prendre ?", domain: "inspection", engine: "EVIDENCE", cluster: "B", requiredEvidence: "inconnues critiques actuelles", hardGuardrail: "Ne pas demander de données sensibles inutiles" },
  { id: "Q38", questionFr: "Quel document me manque le plus ?", domain: "documents", engine: "NEXT_ACTION", cluster: "B", requiredEvidence: "priorité BLOCKING > CRITICAL_UNKNOWN", hardGuardrail: "Pas de simple liste alphabétique" },
  { id: "Q39", questionFr: "Quel professionnel dois-je contacter maintenant ?", domain: "workflow", engine: "NEXT_ACTION", cluster: "B", requiredEvidence: "next_best_action + catégorie du problème", hardGuardrail: "Ne pas recommander un prestataire inventé" },
  { id: "Q40", questionFr: "Dois-je faire une offre maintenant ou attendre ?", domain: "decision", engine: "DECISION", cluster: "B", requiredEvidence: "blocking_issue + inconnues critiques + faisabilité + opportunité", hardGuardrail: "Pas de conseil d'achat définitif" },
  { id: "Q41", questionFr: "Pourquoi ma note est bonne mais le projet déconseillé ?", domain: "decision", engine: "EXPLAINABILITY", cluster: "B", requiredEvidence: "opportunity_score + blocking_issue + verdict global", hardGuardrail: "Jamais masquer le conflit" },
  { id: "Q42", questionFr: "Pourquoi ma note est mauvaise alors que le prix est très bas ?", domain: "decision", engine: "EXPLAINABILITY", cluster: "B", requiredEvidence: "sous-scores (prix/travaux/âge/état)", hardGuardrail: "Pas de score opaque" },
  { id: "Q43", questionFr: "Quelle information pourrait changer le plus mon verdict ?", domain: "next_action", engine: "NEXT_ACTION", cluster: "B", requiredEvidence: "toutes les inconnues critiques + priorités", hardGuardrail: "Pas de ML opaque requis" },
  { id: "Q44", questionFr: "Qu'est-ce qui pourrait faire exploser le budget ?", domain: "finance", engine: "RISK", cluster: "B", requiredEvidence: "inconnues critiques + frais cachés + scénarios travaux", hardGuardrail: "Montant seulement si source/devis" },
  { id: "Q45", questionFr: "Quels coûts sont certains et lesquels sont estimés ?", domain: "finance", engine: "EXPLAINABILITY", cluster: "B", requiredEvidence: "budget segmenté par origine (fait/estimation/utilisateur/inconnu)", hardGuardrail: "Ne jamais mélanger dans un total sans légende" },
  { id: "Q46", questionFr: "Que se passe-t-il si le yen change ?", domain: "finance", engine: "SENSITIVITY", cluster: "C", requiredEvidence: "taux JPY/EUR daté (API)", hardGuardrail: "Ne pas prédire le marché des changes" },
  { id: "Q47", questionFr: "Puis-je comparer deux akiya objectivement ?", domain: "decision", engine: "COMPARISON", cluster: "B", requiredEvidence: "champs normalisés des projets", hardGuardrail: "Ne pas inventer un score manquant" },
  { id: "Q48", questionFr: "La commune est-elle en déclin ?", domain: "market", engine: "LOCAL_CONTEXT", cluster: "C", requiredEvidence: "population_current + population_change_rate (e-Stat)", hardGuardrail: "Déclin démographique ≠ mauvais achat" },
  { id: "Q49", questionFr: "Y a-t-il des services essentiels autour ?", domain: "market", engine: "LOCAL_CONTEXT", cluster: "C", requiredEvidence: "distances gare/santé (données locales)", hardGuardrail: "Pas de note subjective 'bon service'" },
  { id: "Q50", questionFr: "Qui surveillera la maison quand je serai en France ?", domain: "remote_owner", engine: "REMOTE_LIFE", cluster: "A", requiredEvidence: "local_management_arrangement (Remote Owner)", hardGuardrail: "Pas d'hypothèse sur le voisinage" },
  { id: "Q51", questionFr: "Que risque une maison laissée vide longtemps ?", domain: "remote_owner", engine: "REMOTE_LIFE", cluster: "A", requiredEvidence: "occupancy_pattern + maintenance_plan_status", hardGuardrail: "Pas de probabilité inventée" },
  { id: "Q52", questionFr: "Quels engagements locaux dois-je anticiper ?", domain: "local_life", engine: "LOCAL_LIFE", cluster: "C", requiredEvidence: "règlement local (mairie)", hardGuardrail: "Ne pas généraliser depuis des anecdotes" },
  { id: "Q53", questionFr: "Que dois-je demander à l'agent immobilier ?", domain: "workflow", engine: "WORKFLOW", cluster: "B", requiredEvidence: "champs manquants + inconnues critiques", hardGuardrail: "Pas de questions déjà résolues" },
  { id: "Q54", questionFr: "Que dois-je demander au vendeur ?", domain: "workflow", engine: "WORKFLOW", cluster: "B", requiredEvidence: "preuves manquantes + problèmes constatés", hardGuardrail: "Ne pas accuser sans preuve" },
  { id: "Q55", questionFr: "Puis-je revendre facilement plus tard ?", domain: "exit", engine: "EXIT", cluster: "A", requiredEvidence: "contexte historique (Exit Strategy)", hardGuardrail: "Ne pas promettre la revente" },
  { id: "Q56", questionFr: "Puis-je gagner de l'argent avec cette akiya ?", domain: "exit", engine: "EXIT", cluster: "A", requiredEvidence: "hypothèses de location saisies (Exit Strategy)", hardGuardrail: "Pas de rendement présenté comme garanti" },
  { id: "Q57", questionFr: "Faut-il démolir plutôt que rénover ?", domain: "decision", engine: "TRADEOFF", cluster: "A", requiredEvidence: "rebuild_status + comparaison démolition (Exit Strategy)", hardGuardrail: "Ne pas recommander la démolition sans statut juridique" },
  { id: "Q58", questionFr: "Quel est le meilleur scénario : optimiste ou prudent ?", domain: "finance", engine: "EXPLAINABILITY", cluster: "A", requiredEvidence: "scénarios de budget (optimiste/réaliste/prudent)", hardGuardrail: "Ne pas choisir arbitrairement" },
  { id: "Q59", questionFr: "Puis-je acheter avec mon meilleur ami ?", domain: "legal", engine: "LEGAL", cluster: "E", requiredEvidence: "structure juridique de co-propriété", hardGuardrail: "Pas de montage juridique automatique", routeTo: "juriste" },
  { id: "Q60", questionFr: "Que se passe-t-il si l'un des deux veut vendre ?", domain: "legal", engine: "LEGAL", cluster: "E", requiredEvidence: "accord de co-propriété préalable", hardGuardrail: "Ne pas inventer de règles contractuelles", routeTo: "juriste" },
  { id: "Q61", questionFr: "Qu'est-ce que l'application sait réellement ?", domain: "explainability", engine: "TRUST", cluster: "B", requiredEvidence: "origine/statut de tous les champs", hardGuardrail: "Aucune donnée cachée" },
  { id: "Q62", questionFr: "Sur quoi l'application se base pour cette recommandation ?", domain: "explainability", engine: "TRUST", cluster: "B", requiredEvidence: "règle appliquée + champs utilisés + sources", hardGuardrail: "Pas de boîte noire" },
  { id: "Q63", questionFr: "Quelle donnée est devenue obsolète ?", domain: "data_quality", engine: "DATA_QUALITY", cluster: "C", requiredEvidence: "source_date + refresh_frequency (non trackés par projet aujourd'hui)", hardGuardrail: "Ne pas supprimer silencieusement l'historique" },
  { id: "Q64", questionFr: "Quelle source est la plus fiable ?", domain: "data_quality", engine: "DATA_QUALITY", cluster: "B", requiredEvidence: "authoritative_source + confidence", hardGuardrail: "Ne pas confondre confiance et vérité" },
  { id: "Q65", questionFr: "Puis-je partager ce projet sans révéler mes finances ?", domain: "sharing", engine: "PRIVACY", cluster: "A", requiredEvidence: "partage sécurisé + RLS (déjà en place)", hardGuardrail: "Pas de filtrage uniquement UI" },
  { id: "Q66", questionFr: "Que dois-je faire si une information est contradictoire ?", domain: "data_quality", engine: "DATA_QUALITY", cluster: "C", requiredEvidence: "détection de conflit entre deux valeurs (non implémentée)", hardGuardrail: "Pas de moyenne automatique" },
  { id: "Q67", questionFr: "Une annonce peut-elle être incomplète ou trompeuse ?", domain: "data_quality", engine: "TRUST", cluster: "C", requiredEvidence: "distinction champ annonce / champ vérifié (non implémentée)", hardGuardrail: "Pas de confiance implicite" },
  { id: "Q68", questionFr: "Quel est mon niveau de préparation avant achat ?", domain: "workflow", engine: "READINESS", cluster: "B", requiredEvidence: "due_diligence + inconnues critiques + documents", hardGuardrail: "Pas de score global cachant un blocage" },
  { id: "Q69", questionFr: "Puis-je suivre l'évolution du projet dans le temps ?", domain: "history", engine: "HISTORY", cluster: "A", requiredEvidence: "historique des hypothèses (Phase P)", hardGuardrail: "Ne pas réécrire l'historique" },
  { id: "Q70", questionFr: "Qu'est-ce qui a changé après la visite ?", domain: "history", engine: "HISTORY", cluster: "A", requiredEvidence: "marqueurs avant/après (Phase P)", hardGuardrail: "Pas de mécanisme parallèle" },
];

export const QUESTION_BY_ID: Record<string, QuestionDef> = Object.fromEntries(
  QUESTION_REGISTRY.map((q) => [q.id, q]),
);

export type AnswerStatus =
  | "ANSWERED"
  | "PARTIAL"
  | "INSUFFICIENT_DATA"
  | "REQUIRES_OFFICIAL_SOURCE"
  | "REQUIRES_PROFESSIONAL";

export type Verdict = "GREEN" | "ORANGE" | "RED" | null;

export interface QuestionAnswer {
  questionId: string;
  status: AnswerStatus;
  verdict: Verdict;
  answer: string;
  knownFacts: string[];
  estimates: string[];
  unknowns: string[];
  reason: Reason;
  nextBestAction: string | null;
}

export interface ProjectSnapshot {
  nextActionInput: NextActionInput;
  opportunityScore: number;
  opportunityCategory: OpportunityCategory;
  budget: {
    totalProjetJpy: number;
    travauxJpy: number;
    acquisitionJpy: number;
    aidesJpy: number;
  };
}

function insufficientDataAnswer(def: QuestionDef): QuestionAnswer {
  return {
    questionId: def.id,
    status: "INSUFFICIENT_DATA",
    verdict: null,
    answer: "Information insuffisante pour répondre.",
    knownFacts: [],
    estimates: [],
    unknowns: [`Donnée nécessaire : ${def.requiredEvidence}.`],
    reason: { ruleId: `${def.id}_insufficient_data`, message: def.hardGuardrail, fieldsUsed: [] },
    nextBestAction: null,
  };
}

function officialSourceAnswer(def: QuestionDef): QuestionAnswer {
  return {
    questionId: def.id,
    status: "REQUIRES_OFFICIAL_SOURCE",
    verdict: null,
    answer: `Cette réponse nécessite une source officielle (${def.requiredEvidence}), non intégrée à l'application aujourd'hui — aucune donnée n'est inventée à sa place.`,
    knownFacts: [],
    estimates: [],
    unknowns: [def.requiredEvidence],
    reason: { ruleId: `${def.id}_requires_official_source`, message: def.hardGuardrail, fieldsUsed: [] },
    nextBestAction: null,
  };
}

function professionalRoutingAnswer(def: QuestionDef): QuestionAnswer {
  const route = def.routeTo ? PROFESSIONAL_ROUTE_LABELS[def.routeTo] : "un professionnel qualifié";
  return {
    questionId: def.id,
    status: "REQUIRES_PROFESSIONAL",
    verdict: null,
    answer: `Cette question ne doit pas être automatisée : consultez ${route}. ${def.hardGuardrail}.`,
    knownFacts: [],
    estimates: [],
    unknowns: [],
    reason: { ruleId: `${def.id}_requires_professional`, message: def.hardGuardrail, fieldsUsed: [] },
    nextBestAction: null,
  };
}

// Détermine le professionnel pertinent à partir de l'identifiant de règle
// d'un signal Next Best Action — même logique de préfixe que les champs
// due diligence / Reality Gate déjà nommés dans ces moteurs.
function routeForSignal(signal: PrioritizedAction): ProfessionalRoute {
  const id = signal.reason.ruleId;
  if (id.includes("juridique") || id.includes("land_nature")) return "juriste";
  if (id.includes("batiment")) return "professionnel_batiment";
  if (id.includes("terrain_limites") || id.includes("terrain_bornage")) return "arpenteur";
  if (id.includes("reseau")) return "entrepreneur";
  return "mairie";
}

// Réponse générique pour une question dont l'évidence requise est un
// sous-ensemble d'items du Property Reality Gate (Q03, Q04, Q05, Q13-16,
// Q21, Q22) : le statut le plus défavorable des items concernés prime,
// jamais moyenné — même règle "un problème/une inconnue ne se dilue
// jamais" que computeRealityGate.
function realityGateStatusAnswer(questionId: string, itemIds: string[], snap: ProjectSnapshot): QuestionAnswer {
  const { realityGate } = snap.nextActionInput;
  const items = itemIds.map((itemId) => ({
    itemId,
    label: REALITY_GATE_TEMPLATE.find((i) => i.id === itemId)?.label ?? itemId,
    status: (realityGate[itemId] ?? "a_confirmer") as RealityGateItemStatus,
  }));
  const worst: RealityGateItemStatus = items.some((i) => i.status === "probleme")
    ? "probleme"
    : items.some((i) => i.status === "a_confirmer")
      ? "a_confirmer"
      : "verifie";
  const verdict: Verdict = worst === "probleme" ? "RED" : worst === "a_confirmer" ? "ORANGE" : "GREEN";
  const knownFacts = items.filter((i) => i.status === "verifie").map((i) => `${i.label} : vérifié`);
  const unknowns = items
    .filter((i) => i.status !== "verifie")
    .map((i) => `${i.label} : ${REALITY_GATE_STATUS_LABELS[i.status]}`);
  const worstItem = items.find((i) => i.status === worst && worst !== "verifie");
  return {
    questionId,
    status: worst === "verifie" ? "ANSWERED" : "PARTIAL",
    verdict,
    answer:
      worst === "verifie"
        ? "Tous les éléments concernés sont vérifiés."
        : `${unknowns.length} élément(s) à vérifier avant de considérer ce point comme acquis.`,
    knownFacts,
    estimates: [],
    unknowns,
    reason: {
      ruleId: `${questionId}_reality_gate`,
      message: "Statut directement issu du Property Reality Gate — jamais moyenné",
      fieldsUsed: itemIds.map((id) => `realityGate.${id}`),
    },
    nextBestAction: worstItem ? (REALITY_GATE_PROBLEM_ACTIONS[worstItem.itemId] ?? null) : null,
  };
}

const BESPOKE_HANDLERS: Record<string, (snap: ProjectSnapshot) => QuestionAnswer> = {
  Q03: (snap) => realityGateStatusAnswer("Q03", [RECONSTRUCTION_ITEM_ID], snap),
  Q04: (snap) =>
    realityGateStatusAnswer(
      "Q04",
      ["acces_route_publique", "acces_route_privee", "acces_droit_passage", "acces_servitude"],
      snap,
    ),
  Q05: (snap) =>
    realityGateStatusAnswer("Q05", ["reseau_eau", "reseau_egout", "reseau_electricite", "reseau_internet"], snap),
  Q13: (snap) => realityGateStatusAnswer("Q13", ["reseau_electricite"], snap),
  Q14: (snap) => realityGateStatusAnswer("Q14", ["reseau_eau", "reseau_egout"], snap),
  Q15: (snap) => realityGateStatusAnswer("Q15", ["reseau_fosse"], snap),
  Q16: (snap) => realityGateStatusAnswer("Q16", ["reseau_internet"], snap),
  Q21: (snap) => realityGateStatusAnswer("Q21", ["propriete_titre"], snap),
  Q22: (snap) => realityGateStatusAnswer("Q22", ["propriete_hypotheques"], snap),


  // Q02 — "Est-ce vraiment une bonne affaire ?" : les 4 dimensions
  // affichées séparément, un blocage avéré prime toujours sur la note.
  Q02: (snap) => {
    const signals = buildNextActionSignals(snap.nextActionInput);
    const blocking = signals.find((s) => s.level === "BLOCKING");
    const { feasibility, completion } = snap.nextActionInput;
    const answer = blocking
      ? `Non, pas en l'état : ${blocking.reason.message.toLowerCase()} — un blocage avéré prime toujours sur la note d'opportunité.`
      : `Opportunité ${snap.opportunityScore.toFixed(1)}/10 (${OPPORTUNITY_CATEGORY_LABELS[snap.opportunityCategory]}), faisabilité ${feasibility ? FEASIBILITY_LABELS[feasibility] : "non renseignée"}, dossier ${completion.completed}/${completion.total} vérifié.`;
    return {
      questionId: "Q02",
      status: "ANSWERED",
      verdict: blocking ? "RED" : completion.percent < 70 ? "ORANGE" : "GREEN",
      answer,
      knownFacts: [`Opportunité : ${snap.opportunityScore.toFixed(1)}/10`, `Due diligence : ${completion.completed}/${completion.total}`],
      estimates: [],
      unknowns: blocking ? [] : signals.filter((s) => s.level === "CRITICAL_UNKNOWN").map((s) => s.reason.message),
      reason: { ruleId: "Q02_buy_decision", message: "Un blocage avéré prime sur toute note", fieldsUsed: ["opportunityScore", "feasibility", "completion"] },
      nextBestAction: signals[0]?.message ?? null,
    };
  },

  // Q38 — "Quel document me manque le plus ?" : priorité BLOCKING >
  // CRITICAL_UNKNOWN, jamais une liste alphabétique.
  Q38: (snap) => {
    const [top] = buildNextActionSignals(snap.nextActionInput);
    return {
      questionId: "Q38",
      status: top ? "ANSWERED" : "ANSWERED",
      verdict: top?.level === "BLOCKING" ? "RED" : top?.level === "CRITICAL_UNKNOWN" ? "ORANGE" : "GREEN",
      answer: top ? top.message : "Aucun document prioritaire manquant identifié pour l'instant.",
      knownFacts: [],
      estimates: [],
      unknowns: top ? [top.reason.message] : [],
      reason: top?.reason ?? { ruleId: "Q38_no_gap", message: "Aucun point bloquant identifié", fieldsUsed: [] },
      nextBestAction: top?.message ?? null,
    };
  },

  // Q39 — "Quel professionnel dois-je contacter maintenant ?" : routage
  // déterministe depuis le signal prioritaire, jamais un prestataire
  // inventé.
  Q39: (snap) => {
    const [top] = buildNextActionSignals(snap.nextActionInput);
    if (!top) {
      return {
        questionId: "Q39",
        status: "ANSWERED",
        verdict: "GREEN",
        answer: "Aucun contact professionnel urgent identifié pour l'instant.",
        knownFacts: [],
        estimates: [],
        unknowns: [],
        reason: { ruleId: "Q39_no_gap", message: "Aucun point bloquant identifié", fieldsUsed: [] },
        nextBestAction: null,
      };
    }
    const route = routeForSignal(top);
    return {
      questionId: "Q39",
      status: "ANSWERED",
      verdict: top.level === "BLOCKING" ? "RED" : "ORANGE",
      answer: `Contactez ${PROFESSIONAL_ROUTE_LABELS[route]} : ${top.message}`,
      knownFacts: [],
      estimates: [],
      unknowns: [top.reason.message],
      reason: top.reason,
      nextBestAction: top.message,
    };
  },

  // Q40 — "Dois-je faire une offre maintenant ou attendre ?" : stop /
  // verify / ready to negotiate, jamais un conseil d'achat définitif.
  Q40: (snap) => {
    const signals = buildNextActionSignals(snap.nextActionInput);
    const blocking = signals.find((s) => s.level === "BLOCKING");
    const criticalUnknown = signals.find((s) => s.level === "CRITICAL_UNKNOWN");
    if (blocking) {
      return {
        questionId: "Q40",
        status: "ANSWERED",
        verdict: "RED",
        answer: `Non : ${blocking.reason.message.toLowerCase()} doit être résolu avant toute offre.`,
        knownFacts: [],
        estimates: [],
        unknowns: [],
        reason: blocking.reason,
        nextBestAction: blocking.message,
      };
    }
    if (criticalUnknown) {
      return {
        questionId: "Q40",
        status: "ANSWERED",
        verdict: "ORANGE",
        answer: `Pas encore : vérifiez d'abord — ${criticalUnknown.reason.message.toLowerCase()}.`,
        knownFacts: [],
        estimates: [],
        unknowns: [criticalUnknown.reason.message],
        reason: criticalUnknown.reason,
        nextBestAction: criticalUnknown.message,
      };
    }
    return {
      questionId: "Q40",
      status: "ANSWERED",
      verdict: "GREEN",
      answer: "Aucun blocage ni inconnue critique identifié : le dossier permet d'envisager une négociation.",
      knownFacts: [],
      estimates: [],
      unknowns: [],
      reason: { ruleId: "Q40_ready", message: "Aucun point bloquant identifié", fieldsUsed: [] },
      nextBestAction: signals[0]?.message ?? null,
    };
  },

  // Q41 — "Pourquoi ma note est bonne mais le projet déconseillé ?" :
  // expliciter la hiérarchie, jamais masquer le conflit.
  Q41: (snap) => {
    const signals = buildNextActionSignals(snap.nextActionInput);
    const blocking = signals.find((s) => s.level === "BLOCKING");
    const answer = blocking
      ? `Votre note d'opportunité (${snap.opportunityScore.toFixed(1)}/10) mesure le rapport prix/travaux/localisation — elle ne remplace jamais un fait juridique ou technique avéré. Ici : ${blocking.reason.message.toLowerCase()}, ce qui bloque le projet indépendamment de la note.`
      : "Aucun conflit détecté actuellement entre la note d'opportunité et le verdict global.";
    return {
      questionId: "Q41",
      status: "ANSWERED",
      verdict: blocking ? "RED" : "GREEN",
      answer,
      knownFacts: [`Opportunité : ${snap.opportunityScore.toFixed(1)}/10`],
      estimates: [],
      unknowns: [],
      reason: { ruleId: "Q41_score_conflict", message: "Règles explicites, priorité au fait bloquant", fieldsUsed: ["opportunityScore"] },
      nextBestAction: blocking?.message ?? null,
    };
  },

  // Q42 — "Pourquoi ma note est mauvaise alors que le prix est très bas ?"
  // : le prix n'est qu'une dimension parmi d'autres.
  Q42: (snap) => ({
    questionId: "Q42",
    status: "ANSWERED",
    verdict: null,
    answer: `Le prix d'achat n'est qu'une composante de la note d'opportunité (${OPPORTUNITY_CATEGORY_LABELS[snap.opportunityCategory]}) : l'état du bien, l'âge, les travaux estimés et la localisation comptent également — un prix bas compense rarement un profil de risque défavorable.`,
    knownFacts: [`Catégorie d'opportunité : ${OPPORTUNITY_CATEGORY_LABELS[snap.opportunityCategory]}`],
    estimates: [],
    unknowns: [],
    reason: { ruleId: "Q42_cheap_not_good", message: "Le prix n'est qu'une dimension parmi d'autres", fieldsUsed: ["opportunityCategory"] },
    nextBestAction: null,
  }),

  // Q43 — "Quelle information pourrait changer le plus mon verdict ?" :
  // délègue directement à "What Would Change My Mind" (Phase 3).
  Q43: (snap) => {
    const signals = buildNextActionSignals(snap.nextActionInput);
    const factors = computeWhatWouldChangeMyMind(signals);
    const [first] = factors;
    return {
      questionId: "Q43",
      status: factors.length > 0 ? "ANSWERED" : "ANSWERED",
      verdict: null,
      answer: first ? first.action : "Aucune information ne changerait le verdict actuel : le dossier est complet.",
      knownFacts: [],
      estimates: [],
      unknowns: factors.map((f) => f.action),
      reason: signals[0]?.reason ?? { ruleId: "Q43_no_gap", message: "Aucun point bloquant identifié", fieldsUsed: [] },
      nextBestAction: first?.action ?? null,
    };
  },

  // Q45 — "Quels coûts sont certains et lesquels sont estimés ?" :
  // segmentation explicite FACT/ESTIMATE, jamais mélangée dans un total
  // sans légende.
  Q45: (snap) => ({
    questionId: "Q45",
    status: "ANSWERED",
    verdict: null,
    answer:
      "Frais d'acquisition et taxes : calculés selon un barème légal fixe (fait). Travaux : une estimation par niveau de rénovation choisi, pas un devis (estimation). Aides : montant potentiel, jamais acquis tant que non validé par l'organisme (estimation conditionnelle).",
    knownFacts: [`Acquisition : ${snap.budget.acquisitionJpy.toLocaleString("fr-FR")} JPY`],
    estimates: [
      `Travaux : ${snap.budget.travauxJpy.toLocaleString("fr-FR")} JPY (hypothèse de niveau, pas un devis)`,
      `Aides potentielles : ${snap.budget.aidesJpy.toLocaleString("fr-FR")} JPY (non acquises)`,
    ],
    unknowns: [],
    reason: { ruleId: "Q45_certainty_split", message: "FACT/ESTIMATE/USER_INPUT/UNKNOWN jamais mélangés", fieldsUsed: ["budget"] },
    nextBestAction: null,
  }),

  // Q61 — "Qu'est-ce que l'application sait réellement ?" : vue de
  // traçabilité globale, aucune donnée cachée.
  Q61: (snap) => {
    const { realityGate, completion } = snap.nextActionInput;
    const realityGateUnknowns = Object.values(realityGate).filter((s) => s !== "verifie").length;
    return {
      questionId: "Q61",
      status: "ANSWERED",
      verdict: null,
      answer: `Dossier de due diligence : ${completion.completed}/${completion.total} vérifiés. Reality Gate : ${realityGateUnknowns} élément(s) non encore vérifié(s) ou problématique(s). Rien au-delà n'est présumé favorable.`,
      knownFacts: [`Due diligence vérifiée : ${completion.completed}/${completion.total}`],
      estimates: [],
      unknowns: [`Reality Gate à confirmer/problème : ${realityGateUnknowns}`],
      reason: { ruleId: "Q61_epistemic_status", message: "Traçabilité obligatoire, aucune donnée cachée", fieldsUsed: ["realityGate", "dueDiligence"] },
      nextBestAction: null,
    };
  },

  // Q62 — "Sur quoi l'application se base pour cette recommandation ?" :
  // renvoie la règle exacte et les champs utilisés du signal actif — pas
  // de boîte noire.
  Q62: (snap) => {
    const [top] = buildNextActionSignals(snap.nextActionInput);
    if (!top) {
      return {
        questionId: "Q62",
        status: "ANSWERED",
        verdict: null,
        answer: "Aucune recommandation active : aucun signal (blocage, inconnue, risque) n'est actif actuellement.",
        knownFacts: [],
        estimates: [],
        unknowns: [],
        reason: { ruleId: "Q62_no_signal", message: "Aucun point bloquant identifié", fieldsUsed: [] },
        nextBestAction: null,
      };
    }
    return {
      questionId: "Q62",
      status: "ANSWERED",
      verdict: null,
      answer: `Règle appliquée : "${top.reason.ruleId}" — ${top.reason.message}. Champs utilisés : ${top.reason.fieldsUsed.join(", ") || "aucun champ additionnel"}.`,
      knownFacts: [],
      estimates: [],
      unknowns: [],
      reason: top.reason,
      nextBestAction: top.message,
    };
  },
};

// Point d'entrée principal. Retourne `null` pour une question cluster A/B
// pas encore reliée à un moteur (voir commentaire d'en-tête) — jamais une
// réponse fabriquée pour combler l'absence de câblage.
export function computeQuestionAnswer(questionId: string, snapshot: ProjectSnapshot): QuestionAnswer | null {
  const def = QUESTION_BY_ID[questionId];
  if (!def) return null;

  if (def.cluster === "C") return insufficientDataAnswer(def);
  if (def.cluster === "D") return officialSourceAnswer(def);
  if (def.cluster === "E") return professionalRoutingAnswer(def);

  const handler = BESPOKE_HANDLERS[def.id];
  return handler ? handler(snapshot) : null;
}

// Questions actuellement répondables par l'application (utilisé par la
// vue "Ask My Project" pour ne jamais proposer une question sans réponse
// réelle).
export function listAnswerableQuestions(): QuestionDef[] {
  return QUESTION_REGISTRY.filter(
    (q) => q.cluster === "C" || q.cluster === "D" || q.cluster === "E" || BESPOKE_HANDLERS[q.id],
  );
}
