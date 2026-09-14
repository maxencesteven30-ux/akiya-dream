"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatEur, formatJpy } from "@/lib/format";
import { jpyToEur } from "@/lib/data";
import type { SimulatorState } from "@/lib/types";
import { deriveSearchProfileFromProject, type SearchProfile } from "@/lib/discovery/search-profile";
import {
  buildPropertyListingFromManualIntake,
  createEmptyManualIntakeInput,
  type ManualIntakeInput,
} from "@/lib/discovery/manual-intake";
import {
  parseAreaM2,
  parseBuildingYearTerm,
  parseFloorPlan,
  parsePriceJpy,
  parseRebuildabilityTerm,
  parseSewageTerm,
  parseWalkingDistance,
} from "@/lib/discovery/japanese-terms";
import {
  findCandidateListing,
  removeCandidateListing,
  upsertCandidateListing,
} from "@/lib/discovery/candidate-listings";
import { LISTING_AVAILABILITY_LABELS, type PropertyListing } from "@/lib/discovery/property-listing";
import type { RealityGateItemStatus } from "@/lib/types";
import {
  runDiscoveryEngine,
  type DiscoveryResultItem,
} from "@/lib/discovery/discovery-orchestrator";
import { SearchProfileEditor } from "@/components/simulateur/search-profile-editor";
import { TriStateSelect } from "@/components/simulateur/tri-state-select";

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
const PROFILE_STORAGE_KEY = "akiya-discovery-profile";

const AVAILABILITY_OPTIONS = Object.entries(LISTING_AVAILABILITY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const VERDICT_ICONS: Record<"PASS" | "FAIL" | "UNKNOWN", string> = {
  PASS: "✅",
  FAIL: "⛔",
  UNKNOWN: "🟠",
};

const REBUILDABILITY_HINT_LABELS: Partial<Record<RealityGateItemStatus, string>> = {
  verifie: "droit de reconstruire confirmé",
  probleme: "non reconstructible (再建築不可)",
};

const SEWAGE_HINT_LABELS: Partial<Record<RealityGateItemStatus, string>> = {
  verifie: "raccordement fonctionnel (tout-à-l'égout ou fosse agréée)",
  probleme: "fosse d'aisance non raccordée (汲み取り)",
};

// Retour visuel immédiat sur ce que le parseur a compris — sans ça,
// une saisie non reconnue reste silencieusement "à vérifier" plus loin
// dans le pipeline, sans que l'utilisateur sache pourquoi.
function ParseHint({ raw, hint }: { raw: string | null; hint: string | null }) {
  if (raw === null || raw.trim() === "") return null;
  return hint ? (
    <p className="mt-1 text-xs text-muted-foreground">✓ compris : {hint}</p>
  ) : (
    <p className="mt-1 text-xs text-amber-600">
      ⚠️ format non reconnu — restera &quot;à vérifier&quot;, jamais deviné
    </p>
  );
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<SearchProfile | null>(() => {
    try {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SearchProfile) : null;
    } catch (err) {
      console.error("Lecture du profil de recherche depuis localStorage impossible:", err);
      return null;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(CANDIDATES_STORAGE_KEY, JSON.stringify(candidates));
    } catch (err) {
      console.error("Écriture du pool de candidats dans localStorage impossible:", err);
    }
  }, [candidates]);

  useEffect(() => {
    if (profile === null) return;
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.error("Écriture du profil de recherche dans localStorage impossible:", err);
    }
  }, [profile]);

  const derivedProfile = useMemo(
    () => deriveSearchProfileFromProject(simulatorState),
    [simulatorState],
  );
  const searchProfile = profile ?? derivedProfile;
  const discoveryResult = useMemo(
    () => runDiscoveryEngine(searchProfile, candidates),
    [searchProfile, candidates],
  );
  const verdictById = useMemo(() => {
    const map = new Map<string, "PASS" | "FAIL" | "UNKNOWN">();
    for (const item of discoveryResult.eligible) map.set(item.listing.id, "PASS");
    for (const item of discoveryResult.needsReview) map.set(item.listing.id, "UNKNOWN");
    for (const item of discoveryResult.excluded) map.set(item.listing.id, "FAIL");
    return map;
  }, [discoveryResult]);

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Je n&apos;ai pas encore trouvé de bien — m&apos;aider à chercher
        </Button>
      </div>
    );
  }

  const update = (patch: Partial<ManualIntakeInput>) => setIntake((prev) => ({ ...prev, ...patch }));

  const addToPool = () => {
    if (intake.source.trim() === "" || intake.sourceListingId.trim() === "") return;
    const existing = findCandidateListing(candidates, intake.source, intake.sourceListingId);
    const listing = buildPropertyListingFromManualIntake(
      existing?.id ?? editingId ?? `${intake.source}:${intake.sourceListingId}:${Date.now()}`,
      intake,
    );
    setCandidates((prev) => upsertCandidateListing(prev, listing));
    setIntake(createEmptyManualIntakeInput());
    setEditingId(null);
  };

  // Recharge la saisie brute d'un candidat déjà dans le pool pour la
  // corriger — ré-ajouter remplace au même id (upsertCandidateListing),
  // jamais un doublon. editingId trace explicitement quelle annonce est
  // en cours de modification, pour ne jamais en créer une nouvelle par
  // erreur si l'utilisateur modifie aussi source/numéro d'annonce.
  const editCandidate = (candidate: PropertyListing) => {
    const rawIntake = candidate.rawData as ManualIntakeInput | null;
    if (rawIntake) setIntake(rawIntake);
    setEditingId(candidate.id);
  };

  const cancelEdit = () => {
    setIntake(createEmptyManualIntakeInput());
    setEditingId(null);
  };

  const priceHint = intake.priceRaw ? (() => {
    const value = parsePriceJpy(intake.priceRaw!);
    return value !== null ? `${formatJpy(value)} (≈ ${formatEur(jpyToEur(value))})` : null;
  })() : null;
  const landAreaHint = intake.landAreaRaw ? (() => {
    const value = parseAreaM2(intake.landAreaRaw!);
    return value !== null ? `${value} m²` : null;
  })() : null;
  const buildingAreaHint = intake.buildingAreaRaw ? (() => {
    const value = parseAreaM2(intake.buildingAreaRaw!);
    return value !== null ? `${value} m²` : null;
  })() : null;
  const floorPlanHint = intake.floorPlanRaw ? (() => {
    const result = parseFloorPlan(intake.floorPlanRaw!);
    return result ? `${result.roomCount} pièce(s) hors salon/cuisine` : null;
  })() : null;
  const buildingYearHint = intake.buildingYearRaw ? (() => {
    const year = parseBuildingYearTerm(intake.buildingYearRaw!);
    return year !== null ? `construit en ${year}` : null;
  })() : null;
  const stationDistanceHint = intake.stationDistanceRaw ? (() => {
    const result = parseWalkingDistance(intake.stationDistanceRaw!);
    return result ? `${result.value} min à pied` : null;
  })() : null;
  const rebuildabilityHint = intake.rebuildabilityRaw ? (() => {
    const status = parseRebuildabilityTerm(intake.rebuildabilityRaw!);
    return status ? (REBUILDABILITY_HINT_LABELS[status] ?? null) : null;
  })() : null;
  const sewageHint = intake.sewageRaw ? (() => {
    const status = parseSewageTerm(intake.sewageRaw!);
    return status ? (SEWAGE_HINT_LABELS[status] ?? null) : null;
  })() : null;

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
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </div>

        <SearchProfileEditor
          profile={searchProfile}
          derivedProfile={derivedProfile}
          onChange={setProfile}
          onResetToProject={() => setProfile(derivedProfile)}
        />

        {editingId !== null && (
          <div className="mt-4 flex items-center justify-between rounded-md border border-amber-600/30 bg-amber-600/5 px-3 py-2 text-xs">
            <span className="text-foreground">
              Modification de l&apos;annonce {intake.source} #{intake.sourceListingId}
            </span>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              Annuler
            </Button>
          </div>
        )}

        <FormSection title="Identification">
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
          </div>
        </FormSection>

        <FormSection title="Localisation & prix">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="discovery-price" className="mb-2 block">
                Prix tel qu&apos;affiché (ex. 300万円)
              </Label>
              <Input
                id="discovery-price"
                value={intake.priceRaw ?? ""}
                onChange={(e) => update({ priceRaw: e.target.value.trim() === "" ? null : e.target.value })}
              />
              <ParseHint raw={intake.priceRaw} hint={priceHint} />
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
              <ParseHint raw={intake.stationDistanceRaw} hint={stationDistanceHint} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Caractéristiques du bien">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="discovery-land-area" className="mb-2 block">
                Surface terrain telle qu&apos;affichée (ex. 250㎡)
              </Label>
              <Input
                id="discovery-land-area"
                value={intake.landAreaRaw ?? ""}
                onChange={(e) => update({ landAreaRaw: e.target.value.trim() === "" ? null : e.target.value })}
              />
              <ParseHint raw={intake.landAreaRaw} hint={landAreaHint} />
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
              <ParseHint raw={intake.buildingAreaRaw} hint={buildingAreaHint} />
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
              <ParseHint raw={intake.floorPlanRaw} hint={floorPlanHint} />
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
              <ParseHint raw={intake.buildingYearRaw} hint={buildingYearHint} />
            </div>
            <div>
              <Label htmlFor="discovery-property-type" className="mb-2 block">
                Catégorie brute telle qu&apos;affichée (ex. 宅地, 山林, 畑)
              </Label>
              <Input
                id="discovery-property-type"
                value={intake.propertyType ?? ""}
                onChange={(e) => update({ propertyType: e.target.value.trim() === "" ? null : e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="discovery-availability" className="mb-2 block">
                Statut de l&apos;annonce
              </Label>
              <Select
                value={intake.availabilityStatus}
                onValueChange={(v) => update({ availabilityStatus: v as ManualIntakeInput["availabilityStatus"] })}
              >
                <SelectTrigger id="discovery-availability">
                  <SelectValue>
                    {(v: ManualIntakeInput["availabilityStatus"]) => LISTING_AVAILABILITY_LABELS[v] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="discovery-garden" className="mb-2 block">
                Jardin
              </Label>
              <TriStateSelect
                id="discovery-garden"
                value={intake.hasGarden}
                onChange={(v) => update({ hasGarden: v })}
              />
            </div>
            <div>
              <Label htmlFor="discovery-parking" className="mb-2 block">
                Parking
              </Label>
              <TriStateSelect
                id="discovery-parking"
                value={intake.hasParking}
                onChange={(v) => update({ hasParking: v })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="discovery-description" className="mb-2 block">
                Description recopiée (optionnel)
              </Label>
              <textarea
                id="discovery-description"
                className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                value={intake.descriptionRaw ?? ""}
                onChange={(e) => update({ descriptionRaw: e.target.value.trim() === "" ? null : e.target.value })}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Réseaux & accès" last>
          <div className="grid gap-4 sm:grid-cols-2">
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
              <ParseHint raw={intake.rebuildabilityRaw} hint={rebuildabilityHint} />
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
              <ParseHint raw={intake.sewageRaw} hint={sewageHint} />
            </div>
          </div>
        </FormSection>

        <div className="mt-5">
          <Button
            onClick={addToPool}
            disabled={intake.source.trim() === "" || intake.sourceListingId.trim() === ""}
          >
            {editingId !== null ? "Enregistrer les modifications" : "Ajouter au pool de candidats"}
          </Button>
        </div>

        {candidates.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {candidates.length} candidat{candidates.length > 1 ? "s" : ""} dans le pool
            </p>
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-foreground">
                    <span aria-hidden>{VERDICT_ICONS[verdictById.get(c.id) ?? "UNKNOWN"]}</span>{" "}
                    {c.title ?? `${c.source} #${c.sourceListingId}`}
                    <span className="text-muted-foreground">
                      {c.priceJpy !== null
                        ? ` — ${formatJpy(c.priceJpy)} (≈ ${formatEur(jpyToEur(c.priceJpy))})`
                        : " — prix inconnu"}
                      {` — ${LISTING_AVAILABILITY_LABELS[c.availabilityStatus]}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1 self-end sm:self-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Modifier ${c.title ?? `${c.source} #${c.sourceListingId}`}`}
                      onClick={() => editCandidate(c)}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Retirer ${c.title ?? `${c.source} #${c.sourceListingId}`} du pool`}
                      onClick={() => setCandidates((prev) => removeCandidateListing(prev, c.id))}
                    >
                      Retirer
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {candidates.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 text-sm text-muted-foreground">
              {discoveryResult.eligible.length} éligible{discoveryResult.eligible.length > 1 ? "s" : ""} ·{" "}
              {discoveryResult.needsReview.length} à vérifier ·{" "}
              {discoveryResult.excluded.length} exclu{discoveryResult.excluded.length > 1 ? "s" : ""} sur{" "}
              {candidates.length} candidat{candidates.length > 1 ? "s" : ""}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <DiscoveryResultColumn
                title="Éligibles"
                icon="✅"
                tint="border-emerald-600/30 bg-emerald-600/5"
                items={discoveryResult.eligible}
              />
              <DiscoveryResultColumn
                title="À vérifier"
                icon="🟠"
                tint="border-amber-600/30 bg-amber-600/5"
                items={discoveryResult.needsReview}
              />
              <DiscoveryResultColumn
                title="Exclus"
                icon="⛔"
                tint="border-destructive/30 bg-destructive/5"
                items={discoveryResult.excluded}
              />
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function FormSection({
  title,
  last,
  children,
}: {
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`mt-5 ${last ? "" : "border-b border-border/60 pb-5"}`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function DiscoveryResultColumn({
  title,
  icon,
  tint,
  items,
}: {
  title: string;
  icon: string;
  tint: string;
  items: DiscoveryResultItem[];
}) {
  return (
    <Card className={`p-4 ${tint}`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {title} <span className="text-foreground">({items.length})</span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun bien.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {items.map((item) => (
            <li key={item.listing.id} className="rounded-md border border-border bg-card p-2.5">
              <p className="font-medium text-foreground">
                {item.listing.title ?? `${item.listing.source} #${item.listing.sourceListingId}`}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Score préférences : {item.softPreferenceScore.score}/{item.softPreferenceScore.activeCriteriaCount}
              </p>
              {item.hardConstraintEvaluation.checks.filter((c) => c.status !== "NOT_APPLICABLE").length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                  {item.hardConstraintEvaluation.checks
                    .filter((c) => c.status !== "NOT_APPLICABLE")
                    .map((c) => (
                      <li key={c.criterionId}>
                        {c.label} : <span className="text-foreground">{c.status}</span>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
