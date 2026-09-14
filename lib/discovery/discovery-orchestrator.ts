import type { SearchProfile } from "@/lib/discovery/search-profile";
import type { PropertyListing } from "@/lib/discovery/property-listing";
import { evaluateHardConstraints, type HardConstraintEvaluation } from "@/lib/discovery/hard-constraint-engine";
import { scoreSoftPreferences, type SoftPreferenceScore } from "@/lib/discovery/soft-preference-ranking";

// Era 9 / Phase AM — Discovery Orchestrator.
//
// Scope choisi explicitement (non précisé mot pour mot dans la mission
// d'origine) : AJ élimine (PASS/FAIL/UNKNOWN) et AK classe, mais rien
// jusqu'ici ne les combine en un seul point d'entrée pour un pool de
// candidats. Ce module n'introduit aucun nouveau moteur de décision —
// il appelle exactement evaluateHardConstraints (AJ) et
// scoreSoftPreferences (AK) sur chaque candidat, puis répartit en trois
// listes strictement séparées.
//
// La séparation en trois listes (jamais deux) est la règle centrale :
// un verdict UNKNOWN n'est ni "éligible" ni "exclu" — le fusionner dans
// l'une ou l'autre reviendrait à transformer silencieusement une
// inconnue en PASS ou en FAIL, exactement ce que la mission interdit.

export interface DiscoveryResultItem {
  listing: PropertyListing;
  hardConstraintEvaluation: HardConstraintEvaluation;
  softPreferenceScore: SoftPreferenceScore;
}

export interface DiscoveryResult {
  // Verdict PASS — trié par score de préférence décroissant.
  eligible: DiscoveryResultItem[];
  // Verdict UNKNOWN — nécessite une vérification humaine avant toute
  // décision, jamais assimilé à eligible ni à excluded.
  needsReview: DiscoveryResultItem[];
  // Verdict FAIL.
  excluded: DiscoveryResultItem[];
}

function evaluateCandidate(profile: SearchProfile, listing: PropertyListing): DiscoveryResultItem {
  return {
    listing,
    hardConstraintEvaluation: evaluateHardConstraints(profile.hardConstraints, listing),
    softPreferenceScore: scoreSoftPreferences(profile.softPreferences, listing),
  };
}

function bucketByVerdict(
  items: DiscoveryResultItem[],
  verdict: HardConstraintEvaluation["verdict"],
): DiscoveryResultItem[] {
  return items
    .filter((item) => item.hardConstraintEvaluation.verdict === verdict)
    .sort((a, b) => b.softPreferenceScore.score - a.softPreferenceScore.score);
}

export function runDiscoveryEngine(profile: SearchProfile, candidates: PropertyListing[]): DiscoveryResult {
  const items = candidates.map((listing) => evaluateCandidate(profile, listing));

  return {
    eligible: bucketByVerdict(items, "PASS"),
    needsReview: bucketByVerdict(items, "UNKNOWN"),
    excluded: bucketByVerdict(items, "FAIL"),
  };
}
