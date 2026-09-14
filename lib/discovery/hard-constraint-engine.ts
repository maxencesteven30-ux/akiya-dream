import type { HardConstraints } from "@/lib/discovery/search-profile";
import type { PropertyListing } from "@/lib/discovery/property-listing";

// Era 9 / Phase AJ — Hard Constraint Engine.
//
// Logique à trois états obligatoire (section 9/10 de la mission) :
// PASS / FAIL / UNKNOWN. UNKNOWN ne devient jamais PASS. Un critère non
// activé par l'utilisateur (valeur null ou liste vide dans
// HardConstraints) n'est pas UNKNOWN : il est NOT_APPLICABLE, il ne doit
// influencer ni le verdict global ni compter comme une inconnue
// bloquante — distinction volontaire entre "l'utilisateur n'a pas
// demandé ce filtre" et "l'utilisateur l'a demandé mais on ne sait pas".
//
// Aucun nouveau moteur de score ici : ce module élimine, il ne classe
// pas (le classement par préférences douces reste hors scope d'AJ).

export type ConstraintCheckStatus = "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";

export interface ConstraintCheckResult {
  criterionId: string;
  label: string;
  status: ConstraintCheckStatus;
}

export type HardConstraintVerdict = "PASS" | "FAIL" | "UNKNOWN";

export interface HardConstraintEvaluation {
  verdict: HardConstraintVerdict;
  checks: ConstraintCheckResult[];
}

function checkMaxBudget(maxBudgetJpy: number | null, priceJpy: number | null): ConstraintCheckStatus {
  if (maxBudgetJpy === null) return "NOT_APPLICABLE";
  if (priceJpy === null) return "UNKNOWN";
  return priceJpy <= maxBudgetJpy ? "PASS" : "FAIL";
}

function checkMinBuildingArea(
  minBuildingAreaM2: number | null,
  buildingAreaM2: number | null,
): ConstraintCheckStatus {
  if (minBuildingAreaM2 === null) return "NOT_APPLICABLE";
  if (buildingAreaM2 === null) return "UNKNOWN";
  return buildingAreaM2 >= minBuildingAreaM2 ? "PASS" : "FAIL";
}

// PropertyListing n'expose que roomCount (le nombre issu du 間取り, ex.
// le "3" de "3LDK") — explicitement documenté en Phase AF comme jamais
// assimilable à un nombre de chambres au sens occidental (une pièce
// japonaise n'est pas forcément une chambre). Comparer minBedrooms
// directement à roomCount produirait un PASS/FAIL faux. Tant qu'aucun
// champ "chambres confirmées" n'existe sur PropertyListing, ce critère
// reste donc UNKNOWN dès qu'il est activé — décision honnête, pas un
// bug ni un oubli.
function checkMinBedrooms(minBedrooms: number | null): ConstraintCheckStatus {
  if (minBedrooms === null) return "NOT_APPLICABLE";
  return "UNKNOWN";
}

function checkExcludedPrefecture(
  excludedPrefectures: string[],
  prefecture: string | null,
): ConstraintCheckStatus {
  if (excludedPrefectures.length === 0) return "NOT_APPLICABLE";
  if (prefecture === null) return "UNKNOWN";
  return excludedPrefectures.includes(prefecture) ? "FAIL" : "PASS";
}

// requiresKnownRebuildability : l'utilisateur exige que le droit de
// reconstruire soit déjà confirmé (dans un sens ou dans l'autre —
// verifie ou probleme), pas nécessairement favorable. Un statut encore
// inconnu (rebuildability === null) ne remplit pas cette exigence :
// c'est un FAIL du critère tel que formulé, pas une inconnue résiduelle
// — l'utilisateur a explicitement demandé la confirmation elle-même.
function checkKnownRebuildability(
  requiresKnownRebuildability: boolean | null,
  rebuildability: PropertyListing["rebuildability"],
): ConstraintCheckStatus {
  if (requiresKnownRebuildability !== true) return "NOT_APPLICABLE";
  return rebuildability !== null ? "PASS" : "FAIL";
}

const CRITERIA: {
  id: string;
  label: string;
  check: (constraints: HardConstraints, listing: PropertyListing) => ConstraintCheckStatus;
}[] = [
  {
    id: "maxBudgetJpy",
    label: "Budget maximum",
    check: (c, l) => checkMaxBudget(c.maxBudgetJpy, l.priceJpy),
  },
  {
    id: "minBuildingAreaM2",
    label: "Surface habitable minimale",
    check: (c, l) => checkMinBuildingArea(c.minBuildingAreaM2, l.buildingAreaM2),
  },
  {
    id: "minBedrooms",
    label: "Nombre de chambres minimal",
    check: (c) => checkMinBedrooms(c.minBedrooms),
  },
  {
    id: "excludedPrefectures",
    label: "Préfectures exclues",
    check: (c, l) => checkExcludedPrefecture(c.excludedPrefectures, l.prefecture),
  },
  {
    id: "requiresKnownRebuildability",
    label: "Droit de reconstruire confirmé exigé",
    check: (c, l) => checkKnownRebuildability(c.requiresKnownRebuildability, l.rebuildability),
  },
];

function computeVerdict(checks: ConstraintCheckResult[]): HardConstraintVerdict {
  if (checks.some((c) => c.status === "FAIL")) return "FAIL";
  if (checks.some((c) => c.status === "UNKNOWN")) return "UNKNOWN";
  return "PASS";
}

export function evaluateHardConstraints(
  constraints: HardConstraints,
  listing: PropertyListing,
): HardConstraintEvaluation {
  const checks = CRITERIA.map(({ id, label, check }) => ({
    criterionId: id,
    label,
    status: check(constraints, listing),
  }));

  return { verdict: computeVerdict(checks), checks };
}
