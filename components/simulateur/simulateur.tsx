"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfilSection } from "@/components/simulateur/profil-section";
import {
  HOUSE_PRICE_MAX_JPY,
  HOUSE_PRICE_MIN_JPY,
  ProjetSection,
} from "@/components/simulateur/projet-section";
import { ResultatSection } from "@/components/simulateur/resultat-section";
import { BudgetSection } from "@/components/simulateur/budget-section";
import { ComparateurSection } from "@/components/simulateur/comparateur-section";
import { RegionFinder } from "@/components/simulateur/region-finder";
import { JapanMap } from "@/components/simulateur/japan-map";
import { RealListingSection } from "@/components/simulateur/real-listing-section";
import { HiddenCostsSection } from "@/components/simulateur/hidden-costs-section";
import { DueDiligenceSection } from "@/components/simulateur/due-diligence-section";
import { OpportunitySection } from "@/components/simulateur/opportunity-section";
import { HistorySection } from "@/components/simulateur/history-section";
import { SubsidiesSection } from "@/components/simulateur/subsidies-section";
import { SavedProjectsSection } from "@/components/simulateur/saved-projects-section";
import { ExportSection } from "@/components/simulateur/export-section";
import { TaxProjectionSection } from "@/components/simulateur/tax-projection-section";
import { Roadmap } from "@/components/roadmap/roadmap";
import { computeBudget, computeBudgetScenarios } from "@/lib/calculations";
import { compareProperties } from "@/lib/comparison";
import { fetchRegionAttributeDetails, fetchRegionAttributes, fetchRegions } from "@/lib/data";
import { computeOpportunityScore } from "@/lib/opportunity";
import { createEmptyChecklist } from "@/lib/due-diligence";
import { createHistoryEntry } from "@/lib/history";
import { EUR_JPY_RATE } from "@/lib/data";
import type {
  AccompanimentLevel,
  BuyerProfile,
  ChecklistStatus,
  HiddenCostsSelection,
  HistoryEntry,
  NewProjectInput,
  PersistedProject,
  RealListing,
  RegionAttributeDetail,
  RegionAttributes,
  RenovationLevel,
  Region,
  SavedProject,
  SimulatorState,
  Subsidy,
} from "@/lib/types";

const MAX_SAVED_PROJECTS = 3;
const COMPARISONS_STORAGE_KEY = "akiya-comparisons";
const HISTORY_STORAGE_KEY = "akiya-history";
// Doit rester identique à la constante du même nom dans
// app/partage/[token]/page.tsx.
const PENDING_IMPORT_STORAGE_KEY = "akiya-import-project";

const DEFAULT_STATE: SimulatorState = {
  profile: null,
  housePriceJpy: 3000000,
  prefecture: null,
  renovationLevel: null,
  capitalDisponibleEur: null,
  reserveSecuriteEur: null,
  realListing: null,
  accompanimentLevel: "autonome",
  needsTranslation: false,
  hiddenCosts: {
    surveyBoundary: false,
    pestTreatment: false,
    septicTankService: false,
    backTaxesNegotiation: false,
  },
  snowyRegion: false,
  // Quasi obligatoire en pratique (intégration sociale, ramassage des
  // ordures) : coché par défaut dans l'UI, mais le moteur de calcul reste
  // lui-même opt-in (défaut false) pour ne rien changer silencieusement.
  includeNeighborhoodAssociation: true,
  dueDiligence: createEmptyChecklist(),
  history: [],
};

export function Simulateur() {
  // Lecture paresseuse (jamais dans un effet) d'un projet déposé par la page
  // /partage/[token] ("Charger dans mon simulateur") : consommé une seule
  // fois puis retiré, pour ne pas recharger le même projet à chaque
  // rafraîchissement de la page d'accueil.
  const [state, setState] = useState<SimulatorState>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE;

    // Historique des points d'étape : persistant localement (pas encore lié
    // à Supabase, cf. lib/history.ts), lu une seule fois ici comme le reste
    // de l'état initial paresseux.
    let history: HistoryEntry[] = [];
    try {
      const rawHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (rawHistory) history = JSON.parse(rawHistory) as HistoryEntry[];
    } catch (err) {
      console.error("Lecture de l'historique depuis localStorage impossible:", err);
    }

    try {
      const raw = window.localStorage.getItem(PENDING_IMPORT_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE, history };
      window.localStorage.removeItem(PENDING_IMPORT_STORAGE_KEY);
      const project = JSON.parse(raw) as PersistedProject;
      return {
        ...DEFAULT_STATE,
        profile: project.profile,
        housePriceJpy: project.housePriceJpy,
        prefecture: project.prefecture,
        renovationLevel: project.renovationLevel,
        capitalDisponibleEur: project.capitalDisponibleEur,
        reserveSecuriteEur: project.reserveSecuriteEur,
        realListing: project.realListing,
        history,
      };
    } catch (err) {
      console.error("Import du projet partagé impossible:", err);
      return { ...DEFAULT_STATE, history };
    }
  });
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionAttributes, setRegionAttributes] = useState<Record<string, RegionAttributes>>({});
  const [regionAttributeDetails, setRegionAttributeDetails] = useState<
    Record<string, RegionAttributeDetail[]>
  >({});
  // Comparateur : persistance locale (pas de compte requis, contrairement à
  // "Mes projets sauvegardés" qui utilise Supabase). Lecture via
  // l'initialiseur paresseux de useState (jamais dans un effet) : exécuté
  // une seule fois, côté client uniquement — côté serveur, `window` est
  // absent et on retombe simplement sur un tableau vide.
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(COMPARISONS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SavedProject[]) : [];
    } catch (err) {
      console.error("Lecture du comparateur depuis localStorage impossible:", err);
      return [];
    }
  });
  const [subsidiesJpy, setSubsidiesJpy] = useState(0);
  const [eligibleSubsidies, setEligibleSubsidies] = useState<Subsidy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    try {
      window.localStorage.setItem(COMPARISONS_STORAGE_KEY, JSON.stringify(savedProjects));
    } catch (err) {
      console.error("Écriture du comparateur dans localStorage impossible:", err);
    }
  }, [savedProjects]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.history));
    } catch (err) {
      console.error("Écriture de l'historique dans localStorage impossible:", err);
    }
  }, [state.history]);

  useEffect(() => {
    let ignore = false;

    fetchRegions()
      .then((regions) => {
        if (ignore) return;
        setRegions(regions);

        fetchRegionAttributes()
          .then((attributes) => {
            if (!ignore) setRegionAttributes(attributes);
          })
          .catch((err: unknown) => {
            // Le moteur de scoring régional est une amélioration, pas une
            // fonctionnalité critique : son échec ne doit pas bloquer le
            // reste du simulateur.
            console.error("fetchRegionAttributes failed:", err);
          });

        fetchRegionAttributeDetails()
          .then((details) => {
            if (!ignore) setRegionAttributeDetails(details);
          })
          .catch((err: unknown) => {
            // Idem : les fiches régionales sont une amélioration, pas
            // une fonctionnalité critique.
            console.error("fetchRegionAttributeDetails failed:", err);
          });
      })
      .catch((err: unknown) => {
        if (ignore) return;
        console.error("Simulateur data fetch failed:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Une erreur inattendue est survenue lors du chargement des données.",
        );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [retryCount]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRetryCount((n) => n + 1);
  };

  const setProfile = (profile: BuyerProfile) =>
    setState((prev) => ({ ...prev, profile }));
  const setHousePriceJpy = (housePriceJpy: number) =>
    setState((prev) => ({ ...prev, housePriceJpy }));
  const setPrefecture = (prefecture: string) =>
    setState((prev) => {
      const region = regions.find((r) => r.prefecture === prefecture);
      const housePriceJpy = region
        ? Math.min(
            HOUSE_PRICE_MAX_JPY,
            Math.max(HOUSE_PRICE_MIN_JPY, region.medianPriceJpy),
          )
        : prev.housePriceJpy;
      return { ...prev, prefecture, housePriceJpy };
    });
  const setRenovationLevel = (renovationLevel: RenovationLevel) =>
    setState((prev) => ({ ...prev, renovationLevel }));
  const setCapitalDisponibleEur = (capitalDisponibleEur: number | null) =>
    setState((prev) => ({ ...prev, capitalDisponibleEur }));
  const setReserveSecuriteEur = (reserveSecuriteEur: number | null) =>
    setState((prev) => ({ ...prev, reserveSecuriteEur }));
  const setRealListing = (realListing: RealListing | null) =>
    setState((prev) => ({ ...prev, realListing }));
  const setAccompanimentLevel = (accompanimentLevel: AccompanimentLevel) =>
    setState((prev) => ({ ...prev, accompanimentLevel }));
  const setNeedsTranslation = (needsTranslation: boolean) =>
    setState((prev) => ({ ...prev, needsTranslation }));
  const setHiddenCosts = (hiddenCosts: HiddenCostsSelection) =>
    setState((prev) => ({ ...prev, hiddenCosts }));
  const setSnowyRegion = (snowyRegion: boolean) =>
    setState((prev) => ({ ...prev, snowyRegion }));
  const setIncludeNeighborhoodAssociation = (includeNeighborhoodAssociation: boolean) =>
    setState((prev) => ({ ...prev, includeNeighborhoodAssociation }));
  const setDueDiligenceItem = (itemId: string, status: ChecklistStatus) =>
    setState((prev) => ({
      ...prev,
      dueDiligence: { ...prev.dueDiligence, [itemId]: status },
    }));
  const addHistoryCheckpoint = (
    travauxJpy: number,
    totalProjetJpy: number,
    opportunityScore: number | null,
    isPostVisit: boolean,
  ) =>
    setState((prev) => ({
      ...prev,
      history: [
        ...prev.history,
        createHistoryEntry({
          housePriceJpy: prev.housePriceJpy,
          travauxJpy,
          totalProjetJpy,
          eurJpyRate: EUR_JPY_RATE,
          opportunityScore,
          isPostVisit,
        }),
      ],
    }));
  const deleteHistoryEntry = (id: string) =>
    setState((prev) => ({ ...prev, history: prev.history.filter((entry) => entry.id !== id) }));

  const addToComparateur = () => {
    if (!state.profile || !state.renovationLevel) return;

    const baseName =
      state.realListing?.name.trim() ||
      (state.prefecture ? state.prefecture.replace(/_/g, " ") : "Projet");
    const existingNames = new Set(savedProjects.map((p) => p.name));
    let name = baseName;
    let suffix = 2;
    while (existingNames.has(name)) {
      name = `${baseName} (${suffix})`;
      suffix += 1;
    }

    setSavedProjects((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        profile: state.profile!,
        housePriceJpy: state.housePriceJpy,
        renovationLevel: state.renovationLevel!,
        prefecture: state.prefecture,
        realListing: state.realListing,
      },
    ]);
  };

  const removeFromComparateur = (id: string) =>
    setSavedProjects((prev) => prev.filter((p) => p.id !== id));

  const currentProjectInput: NewProjectInput | null =
    state.profile && state.renovationLevel
      ? {
          name:
            state.realListing?.name.trim() ||
            (state.prefecture ? state.prefecture.replace(/_/g, " ") : "Mon projet"),
          profile: state.profile,
          housePriceJpy: state.housePriceJpy,
          prefecture: state.prefecture,
          renovationLevel: state.renovationLevel,
          capitalDisponibleEur: state.capitalDisponibleEur,
          reserveSecuriteEur: state.reserveSecuriteEur,
          realListing: state.realListing,
        }
      : null;

  // Réutilisé par la section Historique (Phase P) pour capturer les
  // travaux estimés et la note d'opportunité au moment du point d'étape,
  // avec le même calcul que la section Opportunité elle-même.
  const historyOpportunityResult =
    state.realListing && state.profile && state.renovationLevel
      ? computeOpportunityScore({
          prixAchatJpy: state.housePriceJpy,
          profile: state.profile,
          renovationLevel: state.renovationLevel,
          region: regions.find((r) => r.prefecture === state.prefecture) ?? null,
          listing: state.realListing,
          capitalDisponibleEur: state.capitalDisponibleEur,
          reserveSecuriteEur: state.reserveSecuriteEur,
        })
      : null;

  const loadPersistedProject = (project: PersistedProject) => {
    setState((prev) => ({
      profile: project.profile,
      housePriceJpy: project.housePriceJpy,
      prefecture: project.prefecture,
      renovationLevel: project.renovationLevel,
      capitalDisponibleEur: project.capitalDisponibleEur,
      reserveSecuriteEur: project.reserveSecuriteEur,
      realListing: project.realListing,
      // Pas encore persistés côté Supabase : on conserve la sélection en cours.
      accompanimentLevel: prev.accompanimentLevel,
      needsTranslation: prev.needsTranslation,
      hiddenCosts: prev.hiddenCosts,
      snowyRegion: prev.snowyRegion,
      includeNeighborhoodAssociation: prev.includeNeighborhoodAssociation,
      // La checklist de vérification concerne un bien physique précis :
      // charger un autre projet repart d'un dossier vierge plutôt que de
      // conserver par erreur des vérifications faites sur un autre bien.
      dueDiligence: createEmptyChecklist(),
      // Même logique pour l'historique des hypothèses : celui d'un autre
      // bien n'a pas de sens ici.
      history: [],
    }));
  };

  if (loading) {
    return <SimulateurSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6">
          <p className="mb-1 font-medium text-foreground">
            Impossible de charger le simulateur
          </p>
          <p className="mb-4 text-sm text-muted-foreground">{error}</p>
          <Button onClick={handleRetry}>Réessayer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-10 sm:space-y-12 sm:px-8 sm:py-14">
      <SavedProjectsSection currentProject={currentProjectInput} onLoad={loadPersistedProject} />

      <ProfilSection value={state.profile} onChange={setProfile} />

      <AnimatePresence>
        {state.profile && (
          <>
            <Separator />
            <RegionFinder
              regions={regions}
              regionAttributes={regionAttributes}
              capitalDisponibleEur={state.capitalDisponibleEur}
              reserveSecuriteEur={state.reserveSecuriteEur}
              onSelectRegion={setPrefecture}
            />
            <JapanMap
              regions={regions}
              regionAttributes={regionAttributes}
              onSelectRegion={setPrefecture}
            />
            <ProjetSection
              regions={regions}
              regionAttributeDetails={regionAttributeDetails}
              housePriceJpy={state.housePriceJpy}
              onHousePriceChange={setHousePriceJpy}
              prefecture={state.prefecture}
              onPrefectureChange={setPrefecture}
              renovationLevel={state.renovationLevel}
              onRenovationLevelChange={setRenovationLevel}
              accompanimentLevel={state.accompanimentLevel}
              onAccompanimentLevelChange={setAccompanimentLevel}
              needsTranslation={state.needsTranslation}
              onNeedsTranslationChange={setNeedsTranslation}
            />
            <RealListingSection
              realListing={state.realListing}
              onChange={setRealListing}
              onApplyEstimatedPrice={setHousePriceJpy}
            />
            <HiddenCostsSection
              hiddenCosts={state.hiddenCosts}
              onHiddenCostsChange={setHiddenCosts}
              snowyRegion={state.snowyRegion}
              onSnowyRegionChange={setSnowyRegion}
              includeNeighborhoodAssociation={state.includeNeighborhoodAssociation}
              onIncludeNeighborhoodAssociationChange={setIncludeNeighborhoodAssociation}
            />
            {state.realListing && (
              <DueDiligenceSection state={state.dueDiligence} onChange={setDueDiligenceItem} />
            )}
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state.profile && state.prefecture && state.renovationLevel && (
          <>
            <Separator />
            <ResultatSection
              housePriceJpy={state.housePriceJpy}
              region={regions.find((r) => r.prefecture === state.prefecture) ?? null}
              profile={state.profile}
              renovationLevel={state.renovationLevel}
              realListing={state.realListing}
              subsidiesJpy={subsidiesJpy}
              accompanimentLevel={state.accompanimentLevel}
              needsTranslation={state.needsTranslation}
              hiddenCosts={state.hiddenCosts}
              snowyRegion={state.snowyRegion}
              includeNeighborhoodAssociation={state.includeNeighborhoodAssociation}
            />
            <Separator />
            <BudgetSection
              housePriceJpy={state.housePriceJpy}
              profile={state.profile}
              renovationLevel={state.renovationLevel}
              capitalDisponibleEur={state.capitalDisponibleEur}
              onCapitalChange={setCapitalDisponibleEur}
              reserveSecuriteEur={state.reserveSecuriteEur}
              onReserveChange={setReserveSecuriteEur}
              realListing={state.realListing}
              accompanimentLevel={state.accompanimentLevel}
              needsTranslation={state.needsTranslation}
              hiddenCosts={state.hiddenCosts}
            />

            <Separator />
            <TaxProjectionSection
              housePriceJpy={state.housePriceJpy}
              profile={state.profile}
              renovationLevel={state.renovationLevel}
              realListing={state.realListing}
              accompanimentLevel={state.accompanimentLevel}
              needsTranslation={state.needsTranslation}
              hiddenCosts={state.hiddenCosts}
              snowyRegion={state.snowyRegion}
              includeNeighborhoodAssociation={state.includeNeighborhoodAssociation}
            />

            <Separator />
            <SubsidiesSection
              prefecture={state.prefecture}
              onTotalChange={setSubsidiesJpy}
              onEligibleChange={setEligibleSubsidies}
            />

            {state.realListing && (
              <>
                <Separator />
                <OpportunitySection
                  prixAchatJpy={state.housePriceJpy}
                  profile={state.profile}
                  renovationLevel={state.renovationLevel}
                  region={regions.find((r) => r.prefecture === state.prefecture) ?? null}
                  realListing={state.realListing}
                  capitalDisponibleEur={state.capitalDisponibleEur}
                  reserveSecuriteEur={state.reserveSecuriteEur}
                />
                <Separator />
                <HistorySection
                  entries={state.history}
                  currentTravauxJpy={historyOpportunityResult?.budget.travauxJpy ?? 0}
                  currentOpportunityScore={historyOpportunityResult?.score ?? null}
                  eurJpyRate={EUR_JPY_RATE}
                  onCheckpoint={(isPostVisit) =>
                    addHistoryCheckpoint(
                      historyOpportunityResult?.budget.travauxJpy ?? 0,
                      historyOpportunityResult?.budget.totalProjetJpy ?? 0,
                      historyOpportunityResult?.score ?? null,
                      isPostVisit,
                    )
                  }
                  onDelete={deleteHistoryEntry}
                />
              </>
            )}

            <Separator />
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={addToComparateur}
                disabled={savedProjects.length >= MAX_SAVED_PROJECTS}
              >
                + Ajouter au comparateur
              </Button>
            </div>

            <ComparateurSection
              projects={savedProjects}
              onRemove={removeFromComparateur}
              capitalDisponibleEur={state.capitalDisponibleEur}
              reserveSecuriteEur={state.reserveSecuriteEur}
              regions={regions}
            />

            <Separator />
            <Roadmap profile={state.profile} />

            <Separator />
            <ExportSection
              reportData={{
                propertyName:
                  state.realListing?.name.trim() ||
                  (state.prefecture ? state.prefecture.replace(/_/g, " ") : "Mon projet"),
                prefecture: state.prefecture,
                budget: computeBudget(
                  state.housePriceJpy,
                  state.profile,
                  state.renovationLevel,
                  state.realListing?.constructionYear && state.realListing?.surfaceM2
                    ? {
                        constructionYear: state.realListing.constructionYear,
                        surfaceM2: state.realListing.surfaceM2,
                      }
                    : null,
                  state.accompanimentLevel,
                  state.needsTranslation,
                  state.hiddenCosts,
                ),
                scenarios: computeBudgetScenarios(
                  state.housePriceJpy,
                  state.profile,
                  state.renovationLevel,
                  state.realListing?.constructionYear && state.realListing?.surfaceM2
                    ? {
                        constructionYear: state.realListing.constructionYear,
                        surfaceM2: state.realListing.surfaceM2,
                      }
                    : null,
                  subsidiesJpy,
                  state.accompanimentLevel,
                  state.needsTranslation,
                  state.hiddenCosts,
                ),
                opportunity:
                  state.realListing && state.prefecture
                    ? computeOpportunityScore({
                        prixAchatJpy: state.housePriceJpy,
                        profile: state.profile,
                        renovationLevel: state.renovationLevel,
                        region: regions.find((r) => r.prefecture === state.prefecture) ?? null,
                        listing: state.realListing,
                        capitalDisponibleEur: state.capitalDisponibleEur,
                        reserveSecuriteEur: state.reserveSecuriteEur,
                      })
                    : null,
                subsidies: eligibleSubsidies,
              }}
              comparisonAvailable={savedProjects.length > 0}
              comparisonData={compareProperties(
                savedProjects.map((property) => ({
                  property,
                  region: regions.find((r) => r.prefecture === property.prefecture) ?? null,
                  capitalDisponibleEur: state.capitalDisponibleEur,
                  reserveSecuriteEur: state.reserveSecuriteEur,
                })),
              )}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SimulateurSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <div>
        <Skeleton className="mb-2 h-3 w-40" />
        <Skeleton className="mb-5 h-5 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}
