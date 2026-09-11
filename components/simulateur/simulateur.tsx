"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfilSection } from "@/components/simulateur/profil-section";
import { ProjetSection } from "@/components/simulateur/projet-section";
import { ResultatSection } from "@/components/simulateur/resultat-section";
import { Roadmap } from "@/components/roadmap/roadmap";
import { fetchSimulatorData } from "@/lib/data";
import type {
  BuyerProfile,
  CostsData,
  RenovationLevel,
  Region,
  SimulatorState,
} from "@/lib/types";

const DEFAULT_STATE: SimulatorState = {
  profile: null,
  housePriceJpy: 3000000,
  prefecture: null,
  renovationLevel: null,
};

export function Simulateur() {
  const [state, setState] = useState<SimulatorState>(DEFAULT_STATE);
  const [regions, setRegions] = useState<Region[]>([]);
  const [costs, setCosts] = useState<CostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let ignore = false;

    fetchSimulatorData()
      .then(({ regions, costs }) => {
        if (ignore) return;
        setRegions(regions);
        setCosts(costs);
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
    setState((prev) => ({ ...prev, prefecture }));
  const setRenovationLevel = (renovationLevel: RenovationLevel) =>
    setState((prev) => ({ ...prev, renovationLevel }));

  if (loading) {
    return <SimulateurSkeleton />;
  }

  if (error || !costs) {
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
              prefecture={state.prefecture}
              profile={state.profile}
              renovationLevel={state.renovationLevel}
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
