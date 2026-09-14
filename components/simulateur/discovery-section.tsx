"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatJpy } from "@/lib/format";
import type { SimulatorState } from "@/lib/types";
import { deriveSearchProfileFromProject } from "@/lib/discovery/search-profile";
import {
  buildPropertyListingFromManualIntake,
  createEmptyManualIntakeInput,
  type ManualIntakeInput,
} from "@/lib/discovery/manual-intake";
import { upsertCandidateListing, removeCandidateListing } from "@/lib/discovery/candidate-listings";
import type { PropertyListing } from "@/lib/discovery/property-listing";
import {
  runDiscoveryEngine,
  type DiscoveryResultItem,
} from "@/lib/discovery/discovery-orchestrator";

// Era 9 / Phase AN — Discovery UI.
//
// Première interface de la chaîne AE→AM : "voici mon projet, aide-moi à
// trouver des akiya" plutôt que "voici un bien précis, analyse-le".
// Aucune extraction automatisée : la saisie reste manuelle/assistée
// (Phase AH), conformément à la hiérarchie des sources (section 8) —
// l'utilisateur recopie lui-même les champs trouvés sur une annonce
// municipale, cette interface applique seulement les parseurs de
// vocabulaire japonais déjà établis en Phase AF.
//
// Le pool de candidats est géré localement (localStorage dédié), pas
// dans SimulatorState : il ne fait pas partie du projet sauvegardé,
// c'est un espace de recherche, cohérent avec le fait qu'aucune donnée
// saisie ici ne doit être confondue avec le bien réel retenu
// (RealListingSection reste l'endroit où "j'ai trouvé mon bien").

const CANDIDATES_STORAGE_KEY = "akiya-discovery-candidates";

const TRI_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "unknown", label: "Non renseigné" },
  { value: "true", label: "Oui" },
  { value: "false", label: "Non" },
];

function parseTriState(raw: string | null): boolean | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function triStateValue(value: boolean | null): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "unknown";
}

interface DiscoverySectionProps {
  simulatorState: SimulatorState;
}

export function DiscoverySection({ simulatorState }: DiscoverySectionProps) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<PropertyListing[]>(() => {
    try {
      const raw = window.localStorage.getItem(CANDIDATES_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PropertyListing[]) : [];
    } catch (err) {
      console.error("Lecture du pool de candidats depuis localStorage impossible:", err);
      return [];
    }
  });
  const [intake, setIntake] = useState<ManualIntakeInput>(createEmptyManualIntakeInput());

  useEffect(() => {
    try {
      window.localStorage.setItem(CANDIDATES_STORAGE_KEY, JSON.stringify(candidates));
    } catch (err) {
      console.error("Écriture du pool de candidats dans localStorage impossible:", err);
    }
  }, [candidates]);

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Je n&apos;ai pas encore trouvé de bien — m&apos;aider à chercher
        </Button>
      </div>
    );
  }

  const searchProfile = deriveSearchProfileFromProject(simulatorState);
  const discoveryResult = runDiscoveryEngine(searchProfile, candidates);

  const update = (patch: Partial<ManualIntakeInput>) => setIntake((prev) => ({ ...prev, ...patch }));

  const addToPool = () => {
    if (intake.source.trim() === "" || intake.sourceListingId.trim() === "") return;
    const listing = buildPropertyListingFromManualIntake(
      `${intake.source}:${intake.sourceListingId}:${Date.now()}`,
      intake,
    );
    setCandidates((prev) => upsertCandidateListing(prev, listing));
    setIntake(createEmptyManualIntakeInput());
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-border p-6 sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Recherche d&apos;akiya (saisie assistée)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aucune extraction automatisée : recopiez ici les champs affichés sur une
              annonce trouvée sur un site municipal (mairie), pas sur un agrégateur
              commercial sans autorisation vérifiée. Les termes japonais standard (徒歩X分,
              3LDK, 再建築可/不可, 浄化槽…) sont analysés automatiquement.
            </p>
            {searchProfile.hardConstraints.maxBudgetJpy !== null && (
              <p className="mt-2 text-xs font-medium text-foreground">
                Budget maximum dérivé du projet : {formatJpy(searchProfile.hardConstraints.maxBudgetJpy)}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="discovery-source" className="mb-2 block">
              Source (ex. tomi-city-akiyabank)
            </Label>
            <Input
              id="discovery-source"
              value={intake.source}
              onChange={(e) => update({ source: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-source-id" className="mb-2 block">
              Numéro d&apos;annonce
            </Label>
            <Input
              id="discovery-source-id"
              placeholder="ex. 322"
              value={intake.sourceListingId}
              onChange={(e) => update({ sourceListingId: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-source-url" className="mb-2 block">
              URL de l&apos;annonce (optionnel)
            </Label>
            <Input
              id="discovery-source-url"
              value={intake.sourceUrl ?? ""}
              onChange={(e) => update({ sourceUrl: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-title" className="mb-2 block">
              Titre (optionnel)
            </Label>
            <Input
              id="discovery-title"
              value={intake.title ?? ""}
              onChange={(e) => update({ title: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-price" className="mb-2 block">
              Prix tel qu&apos;affiché (ex. 300万円)
            </Label>
            <Input
              id="discovery-price"
              value={intake.priceRaw ?? ""}
              onChange={(e) => update({ priceRaw: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-prefecture" className="mb-2 block">
              Préfecture
            </Label>
            <Input
              id="discovery-prefecture"
              placeholder="ex. 長野県"
              value={intake.prefecture ?? ""}
              onChange={(e) => update({ prefecture: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-municipality" className="mb-2 block">
              Municipalité
            </Label>
            <Input
              id="discovery-municipality"
              placeholder="ex. 東御市"
              value={intake.municipality ?? ""}
              onChange={(e) => update({ municipality: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-land-area" className="mb-2 block">
              Surface terrain telle qu&apos;affichée (ex. 250㎡)
            </Label>
            <Input
              id="discovery-land-area"
              value={intake.landAreaRaw ?? ""}
              onChange={(e) => update({ landAreaRaw: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-building-area" className="mb-2 block">
              Surface habitable telle qu&apos;affichée (ex. 90m²)
            </Label>
            <Input
              id="discovery-building-area"
              value={intake.buildingAreaRaw ?? ""}
              onChange={(e) => update({ buildingAreaRaw: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-floor-plan" className="mb-2 block">
              間取り tel qu&apos;affiché (ex. 3LDK)
            </Label>
            <Input
              id="discovery-floor-plan"
              value={intake.floorPlanRaw ?? ""}
              onChange={(e) => update({ floorPlanRaw: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-building-year" className="mb-2 block">
              Année/âge tel qu&apos;affiché (ex. 1985年建築 ou 築30年)
            </Label>
            <Input
              id="discovery-building-year"
              value={intake.buildingYearRaw ?? ""}
              onChange={(e) => update({ buildingYearRaw: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-station-distance" className="mb-2 block">
              Distance à la gare telle qu&apos;affichée (ex. 徒歩15分)
            </Label>
            <Input
              id="discovery-station-distance"
              value={intake.stationDistanceRaw ?? ""}
              onChange={(e) =>
                update({ stationDistanceRaw: e.target.value.trim() === "" ? null : e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="discovery-rebuildability" className="mb-2 block">
              Droit de reconstruire tel qu&apos;affiché (ex. 再建築可)
            </Label>
            <Input
              id="discovery-rebuildability"
              value={intake.rebuildabilityRaw ?? ""}
              onChange={(e) =>
                update({ rebuildabilityRaw: e.target.value.trim() === "" ? null : e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="discovery-sewage" className="mb-2 block">
              Assainissement tel qu&apos;affiché (ex. 浄化槽)
            </Label>
            <Input
              id="discovery-sewage"
              value={intake.sewageRaw ?? ""}
              onChange={(e) => update({ sewageRaw: e.target.value.trim() === "" ? null : e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="discovery-garden" className="mb-2 block">
              Jardin
            </Label>
            <Select value={triStateValue(intake.hasGarden)} onValueChange={(v) => update({ hasGarden: parseTriState(v) })}>
              <SelectTrigger id="discovery-garden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRI_STATE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="discovery-parking" className="mb-2 block">
              Parking
            </Label>
            <Select value={triStateValue(intake.hasParking)} onValueChange={(v) => update({ hasParking: parseTriState(v) })}>
              <SelectTrigger id="discovery-parking">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRI_STATE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Button
            onClick={addToPool}
            disabled={intake.source.trim() === "" || intake.sourceListingId.trim() === ""}
          >
            Ajouter au pool de candidats
          </Button>
        </div>

        {candidates.length > 0 && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-foreground">
              {candidates.length} candidat{candidates.length > 1 ? "s" : ""} dans le pool
            </p>
            <ul className="space-y-1 text-sm">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span>
                    {c.title ?? `${c.source} #${c.sourceListingId}`}
                    {c.priceJpy !== null ? ` — ${formatJpy(c.priceJpy)}` : " — prix inconnu"}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setCandidates((prev) => removeCandidateListing(prev, c.id))}>
                    Retirer
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {candidates.length > 0 && (
          <div className="mt-6 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <DiscoveryResultColumn title="✅ Éligibles" items={discoveryResult.eligible} />
            <DiscoveryResultColumn title="🟠 À vérifier (inconnu)" items={discoveryResult.needsReview} />
            <DiscoveryResultColumn title="⛔ Exclus" items={discoveryResult.excluded} />
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function DiscoveryResultColumn({ title, items }: { title: string; items: DiscoveryResultItem[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">
        {title} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun bien.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {items.map((item) => (
            <li key={item.listing.id} className="rounded border border-border p-2">
              <p className="font-medium text-foreground">
                {item.listing.title ?? `${item.listing.source} #${item.listing.sourceListingId}`}
              </p>
              <p className="text-muted-foreground">
                Score préférences : {item.softPreferenceScore.score}/{item.softPreferenceScore.activeCriteriaCount}
              </p>
              <ul className="mt-1 space-y-0.5">
                {item.hardConstraintEvaluation.checks
                  .filter((c) => c.status !== "NOT_APPLICABLE")
                  .map((c) => (
                    <li key={c.criterionId}>
                      {c.label} : {c.status}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
