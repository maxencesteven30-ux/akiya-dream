import { describe, expect, it } from "vitest";
import {
  NON_RESIDENT_ADMIN_TEMPLATE,
  computeNonResidentAdminSummary,
  computeVacancyRisk,
  createEmptyNonResidentAdmin,
  createEmptyRemoteOwnerProfile,
  shouldShowVisaWarning,
} from "@/lib/remote-owner";

describe("createEmptyRemoteOwnerProfile", () => {
  it("initialise tous les champs à null/false, jamais un statut positif par défaut", () => {
    const profile = createEmptyRemoteOwnerProfile();
    expect(profile.residenceLocation).toBeNull();
    expect(profile.usageFrequency).toBeNull();
    expect(profile.vacancyDuration).toBeNull();
    expect(profile.caretaker).toBeNull();
    expect(profile.checkFrequency).toBeNull();
    expect(profile.ownershipPurpose).toBeNull();
    expect(profile.ownershipGoal).toBeNull();
    expect(profile.visaPlanConfirmed).toBe(false);
    expect(profile.nonResidentAdmin).toEqual({});
  });
});

describe("computeNonResidentAdminSummary", () => {
  it("retourne 0 pour un état vide", () => {
    const summary = computeNonResidentAdminSummary(createEmptyNonResidentAdmin());
    expect(summary.completed).toBe(0);
    expect(summary.total).toBe(NON_RESIDENT_ADMIN_TEMPLATE.length);
  });

  it("compte les éléments traités", () => {
    const state = createEmptyNonResidentAdmin();
    state[NON_RESIDENT_ADMIN_TEMPLATE[0].id] = true;
    expect(computeNonResidentAdminSummary(state).completed).toBe(1);
  });
});

describe("computeVacancyRisk", () => {
  it("est orange (jamais vert) tant que le plan de gestion n'est pas renseigné", () => {
    const result = computeVacancyRisk({ vacancyDuration: null, caretaker: null, checkFrequency: null });
    expect(result.level).toBe("orange");
  });

  it("est rouge si personne ne surveille la maison, quelle que soit la durée de vacance", () => {
    const result = computeVacancyRisk({
      vacancyDuration: "quelques_semaines",
      caretaker: "personne",
      checkFrequency: "hebdomadaire",
    });
    expect(result.level).toBe("rouge");
  });

  it("est rouge si vérifications annuelles et vacance quasi permanente", () => {
    const result = computeVacancyRisk({
      vacancyDuration: "en_permanence",
      caretaker: "agence",
      checkFrequency: "annuelle",
    });
    expect(result.level).toBe("rouge");
  });

  it("est orange si vérifications seulement annuelles mais vacance courte", () => {
    const result = computeVacancyRisk({
      vacancyDuration: "quelques_semaines",
      caretaker: "ami",
      checkFrequency: "annuelle",
    });
    expect(result.level).toBe("orange");
  });

  it("est orange si vérifications saisonnières mais vacance quasi permanente", () => {
    const result = computeVacancyRisk({
      vacancyDuration: "la_plupart_de_lannee",
      caretaker: "societe_locale",
      checkFrequency: "saisonniere",
    });
    expect(result.level).toBe("orange");
  });

  it("est vert si vérifications hebdomadaires ou mensuelles avec un responsable désigné", () => {
    const result = computeVacancyRisk({
      vacancyDuration: "en_permanence",
      caretaker: "voisin",
      checkFrequency: "mensuelle",
    });
    expect(result.level).toBe("vert");
  });
});

describe("shouldShowVisaWarning", () => {
  it("s'affiche pour un objectif 'future résidence' sans projet de statut confirmé", () => {
    expect(shouldShowVisaWarning("future_residence", false)).toBe(true);
  });

  it("ne s'affiche pas si le projet de statut est confirmé", () => {
    expect(shouldShowVisaWarning("future_residence", true)).toBe(false);
  });

  it("ne s'affiche pas pour les autres objectifs", () => {
    expect(shouldShowVisaWarning("pied_a_terre", false)).toBe(false);
    expect(shouldShowVisaWarning("investissement", false)).toBe(false);
    expect(shouldShowVisaWarning(null, false)).toBe(false);
  });
});
