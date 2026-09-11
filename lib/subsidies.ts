import subsidiesData from "@/data/subsidies.json";
import type { Subsidy, SubsidyType } from "@/lib/types";

const SUBSIDIES = subsidiesData as Subsidy[];

// Sentinel utilisé par les programmes nationaux (non rattachés à une seule
// préfecture) : ils s'appliquent quelle que soit la région choisie.
const NATIONWIDE = "Nationwide";

export function getAllSubsidies(): Subsidy[] {
  return SUBSIDIES;
}

export interface SubsidyEligibilityOptions {
  residenceCommitment: boolean;
  usesAkiyaBank: boolean;
  hasLocalContractor: boolean;
}

// Un programme est retenu si :
// - il est national OU rattaché à la préfecture demandée ;
// - ET aucune condition connue avec certitude n'est explicitement violée.
// Une condition inconnue (null, faute de donnée source fiable) n'exclut
// jamais un programme : on ne devine pas, on ne pénalise pas non plus une
// incertitude qui n'est pas de la responsabilité de l'utilisateur.
export function getEligibleSubsidies(
  prefecture: string,
  options: SubsidyEligibilityOptions,
): Subsidy[] {
  return SUBSIDIES.filter((subsidy) => {
    if (subsidy.prefecture !== NATIONWIDE && subsidy.prefecture !== prefecture) {
      return false;
    }
    if (subsidy.eligibility.requiresAkiyaBank && !options.usesAkiyaBank) {
      return false;
    }
    if (subsidy.eligibility.requiresLocalContractor === true && !options.hasLocalContractor) {
      return false;
    }
    if (
      subsidy.eligibility.minResidenceYears !== null &&
      subsidy.eligibility.minResidenceYears > 0 &&
      !options.residenceCommitment
    ) {
      return false;
    }
    return true;
  });
}

export function computeTotalSubsidies(subsidies: Subsidy[]): number {
  return subsidies.reduce((sum, s) => sum + s.maxAmountJpy, 0);
}

export function filterSubsidiesByType(subsidies: Subsidy[], type: SubsidyType): Subsidy[] {
  return subsidies.filter((s) => s.type === type);
}
