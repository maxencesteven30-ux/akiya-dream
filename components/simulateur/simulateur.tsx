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
import { Roadmap } from "@/components/roadmap/roadmap";
import { fetchRegionAttributes, fetchRegions } from "@/lib/data";
import type {
  BuyerProfile,
  RegionAttributes,
  RenovationLevel,
  Region,
  SavedProject,
  SimulatorState,
} from "@/lib/types";

const MAX_SAVED_PROJECTS = 4;

const DEFAULT_STATE: SimulatorState = {
  profile: null,
  housePriceJpy: 3000000,
  prefecture: null,
  renovationLevel: null,
  capitalDisponibleEur: null,
  reserveSecuriteEur: null,
};

export function Simulateur() {
  const [state, setState] = useState<SimulatorState>(DEFAULT_STATE);
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionAttributes, setRegionAttributes] = useState<Record<string, RegionAttributes>>({});
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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

  const addToComparateur = () => {
    if (!state.profile || !state.renovationLevel) return;

    const baseName = state.prefecture ? state.prefecture.replace(/_/g, " ") : "Projet";
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
      },
    ]);
  };

  const removeFromComparateur = (id: string) =>
    setSavedProjects((prev) => prev.filter((p) => p.id !== id));

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
            <ProjetSection
              regions={regions}
              housePriceJpy={state.housePriceJpy}
              onHousePriceChange={setHousePriceJpy}
              prefecture={state.prefecture}
              onPrefectureChange={setPrefecture}
              renovationLevel={state.renovationLevel}
              onRenovationLevelChange={setRenovationLevel}
            />
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
            />
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
            />

            <Separator />
            <Roadmap profile={state.profile} />
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
