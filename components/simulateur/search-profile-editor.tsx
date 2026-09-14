"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TriStateSelect } from "@/components/simulateur/tri-state-select";
import { formatJpy } from "@/lib/format";
import type { HardConstraints, SearchProfile, SoftPreferences } from "@/lib/discovery/search-profile";

// Era 9 / Phase AP — Search Profile Editor.
//
// AE (deriveSearchProfileFromProject) ne remplit que maxBudgetJpy et
// preferredPrefectures à partir du projet — volontairement, pour ne
// jamais deviner une préférence (jardin, environnement rural...) à
// partir d'un champ qui ne l'implique pas réellement. Jusqu'ici, rien
// dans l'UI ne permettait à l'utilisateur de renseigner lui-même les
// autres critères : AJ (contraintes dures) et AK (préférences douces)
// existaient mais restaient presque inertes en pratique. Ce module
// comble ce vide : chaque champ reste explicitement optionnel (aucune
// valeur par défaut favorable), et les 4 critères qui restent
// structurellement "unknown" dans AJ/AK (minBedrooms, ruralEnvironment,
// noCarRequired, renovationAcceptable) portent une légende qui le dit
// clairement, pour ne jamais laisser croire qu'ils filtrent réellement.

const UNKNOWN_LABEL = "Non décidé";

function parseCommaList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

interface SearchProfileEditorProps {
  profile: SearchProfile;
  derivedProfile: SearchProfile;
  onChange: (profile: SearchProfile) => void;
  onResetToProject: () => void;
}

export function SearchProfileEditor({
  profile,
  derivedProfile,
  onChange,
  onResetToProject,
}: SearchProfileEditorProps) {
  const updateHard = (patch: Partial<HardConstraints>) => {
    onChange({ ...profile, hardConstraints: { ...profile.hardConstraints, ...patch } });
  };
  const updateSoft = (patch: Partial<SoftPreferences>) => {
    onChange({ ...profile, softPreferences: { ...profile.softPreferences, ...patch } });
  };

  return (
    <div className="border-b border-border pb-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Critères de recherche</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Un critère laissé vide reste non renseigné — il n&apos;élimine ni ne favorise
            aucun bien (jamais une valeur par défaut favorable ou défavorable).
          </p>
        </div>
        {derivedProfile.hardConstraints.maxBudgetJpy !== null && (
          <Button variant="ghost" size="sm" onClick={onResetToProject}>
            Recalculer depuis mon projet
          </Button>
        )}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Contraintes dures — éliminent un bien
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="profile-max-budget" className="mb-2 block">
            Budget maximum (JPY)
          </Label>
          <Input
            id="profile-max-budget"
            type="number"
            min={0}
            value={profile.hardConstraints.maxBudgetJpy ?? ""}
            onChange={(e) => updateHard({ maxBudgetJpy: parseNumber(e.target.value) })}
          />
          {derivedProfile.hardConstraints.maxBudgetJpy !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Dérivé du projet : {formatJpy(derivedProfile.hardConstraints.maxBudgetJpy)}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="profile-min-area" className="mb-2 block">
            Surface habitable minimale (m²)
          </Label>
          <Input
            id="profile-min-area"
            type="number"
            min={0}
            value={profile.hardConstraints.minBuildingAreaM2 ?? ""}
            onChange={(e) => updateHard({ minBuildingAreaM2: parseNumber(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="profile-min-bedrooms" className="mb-2 block">
            Nombre de chambres minimal
          </Label>
          <Input
            id="profile-min-bedrooms"
            type="number"
            min={0}
            value={profile.hardConstraints.minBedrooms ?? ""}
            onChange={(e) => updateHard({ minBedrooms: parseNumber(e.target.value) })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Aucune annonce ne confirme un nombre de chambres (seul le 間取り, ex. le &quot;3&quot;
            de 3LDK, est disponible) — ce critère reste donc toujours &quot;à vérifier&quot;.
          </p>
        </div>
        <div>
          <Label htmlFor="profile-excluded-prefectures" className="mb-2 block">
            Préfectures exclues (séparées par des virgules)
          </Label>
          <Input
            id="profile-excluded-prefectures"
            placeholder="ex. 東京都, 大阪府"
            value={profile.hardConstraints.excludedPrefectures.join(", ")}
            onChange={(e) => updateHard({ excludedPrefectures: parseCommaList(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="profile-requires-rebuildability" className="mb-2 block">
            Exiger un droit de reconstruire déjà confirmé
          </Label>
          <TriStateSelect
            id="profile-requires-rebuildability"
            value={profile.hardConstraints.requiresKnownRebuildability}
            onChange={(v) => updateHard({ requiresKnownRebuildability: v })}
            unknownLabel={UNKNOWN_LABEL}
          />
        </div>
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Préférences douces — influencent le classement, n&apos;éliminent jamais
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="profile-preferred-prefectures" className="mb-2 block">
            Préfectures préférées (séparées par des virgules)
          </Label>
          <Input
            id="profile-preferred-prefectures"
            placeholder="ex. 長野県, 岡山県"
            value={profile.softPreferences.preferredPrefectures.join(", ")}
            onChange={(e) => updateSoft({ preferredPrefectures: parseCommaList(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="profile-max-station-distance" className="mb-2 block">
            Distance maximale à la gare (minutes à pied)
          </Label>
          <Input
            id="profile-max-station-distance"
            type="number"
            min={0}
            value={profile.softPreferences.maxStationDistanceMinutes ?? ""}
            onChange={(e) => updateSoft({ maxStationDistanceMinutes: parseNumber(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="profile-wants-garden" className="mb-2 block">
            Jardin souhaité
          </Label>
          <TriStateSelect
            id="profile-wants-garden"
            value={profile.softPreferences.wantsGarden}
            onChange={(v) => updateSoft({ wantsGarden: v })}
            unknownLabel={UNKNOWN_LABEL}
          />
        </div>
        <div>
          <Label htmlFor="profile-rural" className="mb-2 block">
            Environnement rural souhaité
          </Label>
          <TriStateSelect
            id="profile-rural"
            value={profile.softPreferences.ruralEnvironment}
            onChange={(v) => updateSoft({ ruralEnvironment: v })}
            unknownLabel={UNKNOWN_LABEL}
          />
        </div>
        <div>
          <Label htmlFor="profile-no-car" className="mb-2 block">
            Absence de voiture souhaitée
          </Label>
          <TriStateSelect
            id="profile-no-car"
            value={profile.softPreferences.noCarRequired}
            onChange={(v) => updateSoft({ noCarRequired: v })}
            unknownLabel={UNKNOWN_LABEL}
          />
        </div>
        <div>
          <Label htmlFor="profile-renovation" className="mb-2 block">
            Tolérance à la rénovation
          </Label>
          <TriStateSelect
            id="profile-renovation"
            value={profile.softPreferences.renovationAcceptable}
            onChange={(v) => updateSoft({ renovationAcceptable: v })}
            unknownLabel={UNKNOWN_LABEL}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Environnement rural, absence de voiture et tolérance à la rénovation restent toujours
        &quot;à vérifier&quot; dans le classement : aucune annonce ne fournit ces faits directement,
        les déduire d&apos;un autre champ (ex. l&apos;âge du bâtiment) serait une estimation déguisée
        en fait.
      </p>
    </div>
  );
}
