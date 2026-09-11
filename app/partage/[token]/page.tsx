"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/simulateur/money";
import { computeBudget } from "@/lib/calculations";
import { getSharedProject } from "@/lib/data";
import type { PersistedProject } from "@/lib/types";

// Doit rester identique à la constante du même nom dans simulateur.tsx.
const PENDING_IMPORT_STORAGE_KEY = "akiya-import-project";

const PROFILE_LABELS = {
  solo: "Solo",
  duo: "À deux",
  investisseur: "Investisseur",
};

const RENOVATION_LABELS = {
  leger: "Léger",
  standard: "Standard",
  lourd: "Lourd",
};

export default function SharedProjectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<PersistedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getSharedProject(token)
      .then((p) => {
        if (!ignore) setProject(p);
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : "Erreur inconnue.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  const handleImport = () => {
    if (!project) return;
    window.localStorage.setItem(PENDING_IMPORT_STORAGE_KEY, JSON.stringify(project));
    router.push("/");
  };

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-10 sm:px-8 sm:py-14">
          <div>
            <h1 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              🔗 Projet partagé
            </h1>
            <p className="text-lg text-foreground">Quelqu&apos;un a partagé un projet avec toi</p>
          </div>

          {loading && (
            <Card className="border-border p-6 sm:p-8">
              <p className="text-sm text-muted-foreground">Chargement...</p>
            </Card>
          )}

          {!loading && error && (
            <Card className="border-destructive/30 bg-destructive/5 p-6 sm:p-8">
              <p className="text-sm text-destructive">{error}</p>
            </Card>
          )}

          {!loading && !error && !project && (
            <Card className="border-border p-6 sm:p-8">
              <p className="text-sm text-muted-foreground">
                Ce lien de partage est invalide ou a été révoqué par son propriétaire.
              </p>
            </Card>
          )}

          {!loading && !error && project && (
            <SharedProjectSummary project={project} onImport={handleImport} />
          )}
        </div>
      </main>
    </>
  );
}

function SharedProjectSummary({
  project,
  onImport,
}: {
  project: PersistedProject;
  onImport: () => void;
}) {
  const budget = project.renovationLevel
    ? computeBudget(project.housePriceJpy, project.profile, project.renovationLevel)
    : null;

  return (
    <Card className="border-border p-6 sm:p-8">
      <p className="mb-1 text-xl font-medium text-foreground">{project.name}</p>
      <p className="mb-4 text-sm text-muted-foreground">
        {PROFILE_LABELS[project.profile]}
        {project.renovationLevel ? ` · ${RENOVATION_LABELS[project.renovationLevel]}` : ""}
        {project.prefecture ? ` · ${project.prefecture.replace(/_/g, " ")}` : ""}
      </p>

      <ul className="space-y-1.5 text-sm">
        <li className="flex justify-between">
          <span className="text-muted-foreground">Prix d&apos;achat</span>
          <Money jpy={project.housePriceJpy} className="text-foreground" />
        </li>
        {budget && (
          <li className="flex justify-between border-t border-border pt-1.5 font-medium">
            <span className="text-foreground">Coût réel total (estimation)</span>
            <Money jpy={budget.totalProjetJpy} className="text-foreground" />
          </li>
        )}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Ceci est une estimation indicative, pas une expertise immobilière — vérifie chaque élément
        avant toute décision.
      </p>

      <Button className="mt-6" onClick={onImport}>
        Charger dans mon simulateur
      </Button>
    </Card>
  );
}
