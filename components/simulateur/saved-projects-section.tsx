"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deleteProject, fetchMyProjects, saveProject } from "@/lib/data";
import { formatJpy } from "@/lib/format";
import type { NewProjectInput, PersistedProject } from "@/lib/types";

interface SavedProjectsSectionProps {
  currentProject: NewProjectInput | null;
  onLoad: (project: PersistedProject) => void;
}

const PROFILE_LABELS = {
  solo: "Solo",
  duo: "À deux",
  investisseur: "Investisseur",
};

export function SavedProjectsSection({ currentProject, onLoad }: SavedProjectsSectionProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<PersistedProject[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loading = open && !loaded && !error;

  useEffect(() => {
    if (!open || loaded || error) return;
    let ignore = false;
    fetchMyProjects()
      .then((data) => {
        if (!ignore) {
          setProjects(data);
          setLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Erreur inconnue.");
        }
      });
    return () => {
      ignore = true;
    };
  }, [open, loaded, error]);

  const handleSave = () => {
    if (!currentProject) return;
    setSaving(true);
    setSaveError(null);
    saveProject(currentProject)
      .then((saved) => {
        setProjects((prev) => [saved, ...prev]);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        setSaveError(err instanceof Error ? err.message : "Erreur inconnue.");
      })
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: number) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    deleteProject(id).catch((err: unknown) => {
      console.error("Failed to delete project:", err);
      // On ne restaure pas l'élément supprimé localement : mieux vaut
      // recharger la page pour re-synchroniser que de complexifier
      // l'état ici pour un cas d'échec rare.
    });
  };

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Mes projets sauvegardés
        </Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-border p-6 sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Mes projets sauvegardés
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sauvegardés dans Supabase, liés à cet appareil/navigateur (session
              anonyme). Videz les données de site pour perdre l&apos;accès.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </div>

        {currentProject && (
          <div className="mb-4 border-b border-border pb-4">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : "Sauvegarder le projet actuel"}
            </Button>
            {saveError && <p className="mt-2 text-xs text-destructive">{saveError}</p>}
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Chargement...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && projects.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun projet sauvegardé pour l&apos;instant.</p>
        )}

        {projects.length > 0 && (
          <ul className="space-y-2">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {PROFILE_LABELS[project.profile]} · {formatJpy(project.housePriceJpy)}
                    {project.prefecture ? ` · ${project.prefecture.replace(/_/g, " ")}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => onLoad(project)}>
                    Charger
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => handleDelete(project.id)}
                  >
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}
