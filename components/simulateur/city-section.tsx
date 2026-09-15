"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { findPrefectureByRegionLabel, JAPAN_PREFECTURES, type JapanPrefecture } from "@/lib/japan-prefectures";
import type { MunicipalityEntry } from "@/lib/mlit/municipalities-provider";
import { HAZARD_CATEGORY_LABELS } from "@/lib/hazard-contract";
import type { PolygonHazardCategory } from "@/lib/hazard/provider";
import { AMENITY_CATEGORY_LABELS, type AmenityCategory } from "@/lib/amenities/provider";
import { computeCityScore, type CityScoreResult } from "@/lib/city-score";
import type { EstatResult } from "@/lib/estat-contract";

// Onglet "Ville" — vue municipalité, indépendante d'un bien précis ET
// indépendante de la région d'investissement (curatée, 18 préfectures)
// choisie à l'étape 2. Répond à deux constats du 2026-09-15 :
// 1) choisir une préfecture (ex. Kagoshima) sans avoir encore "trouvé un
//    bien précis" ne donnait accès à AUCUNE donnée réelle (démographie,
//    risques, services, gares), alors que la plupart de ces moteurs
//    (e-Stat en particulier) ne nécessitent en réalité qu'un code
//    municipal, jamais une adresse exacte ;
// 2) l'analyse ne doit pas se limiter aux 18 préfectures curatées pour
//    l'investissement akiya (data/regions.json, qui porte des données
//    économiques type prix médian/subvention) : elle fonctionne sur les
//    47 préfectures du Japon, indépendamment de ce jeu de données —
//    l'onglet a son propre sélecteur de préfecture, pré-rempli avec la
//    région choisie à l'étape 2 quand elle existe, mais librement
//    modifiable.
//
// Le point géographique utilisé ici pour les moteurs à base de
// coordonnées (risques, services, gares) est un centre-ville
// APPROXIMATIF résolu via le géocodeur public du GSI (国土地理院,
// gouvernemental, gratuit) — jamais l'adresse d'un bien réel. Affiché
// explicitement partout où il est utilisé.

const HAZARD_CATEGORIES: PolygonHazardCategory[] = ["flood", "tsunami", "landslide", "storm_surge"];
const AMENITY_CATEGORIES: AmenityCategory[] = ["school", "medical", "welfare", "cultural", "town_hall"];

interface HazardFetchResult {
  category: PolygonHazardCategory;
  status: "IN_ZONE" | "OUTSIDE_ZONE" | "INSUFFICIENT_PRECISION" | "DATA_UNAVAILABLE" | "ERROR";
}

interface AmenityFetchResult {
  category: AmenityCategory;
  status: "FOUND" | "NONE_IN_TILE" | "INSUFFICIENT_PRECISION" | "DATA_UNAVAILABLE" | "ERROR";
  nearestName: string | null;
  nearestDistanceMeters: number | null;
}

interface StationFetchResult {
  status: "FOUND" | "NONE_IN_TILE" | "INSUFFICIENT_PRECISION" | "DATA_UNAVAILABLE" | "ERROR";
  nearestName: string | null;
  nearestOperator: string | null;
  nearestLine: string | null;
  nearestDistanceMeters: number | null;
  nearestJrDistanceMeters: number | null;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

interface CitySectionProps {
  prefecture: string | null;
}

// CityExplorer est remonté (via `key`) à chaque changement de préfecture
// plutôt que de réinitialiser manuellement chaque état dans un effet —
// évite les rendus en cascade d'un setState synchrone dans un effet, et
// garantit qu'aucun état d'une préfecture précédente ne survit au
// changement.
function CityExplorer({
  jpPrefecture,
  onChangePrefecture,
}: {
  jpPrefecture: JapanPrefecture;
  onChangePrefecture: (code: string | null) => void;
}) {
  const [municipalities, setMunicipalities] = useState<MunicipalityEntry[]>([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [centerPoint, setCenterPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [population, setPopulation] = useState<EstatResult | null>(null);
  const [households, setHouseholds] = useState<EstatResult | null>(null);
  const [changeRate, setChangeRate] = useState<EstatResult | null>(null);
  const [hazards, setHazards] = useState<HazardFetchResult[]>([]);
  const [amenities, setAmenities] = useState<AmenityFetchResult[]>([]);
  const [station, setStation] = useState<StationFetchResult | null>(null);
  const [cityScore, setCityScore] = useState<CityScoreResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/mlit/municipalities?prefectureCode=${jpPrefecture.code}`)
      .then((res) => res.json())
      .then((data: { status: string; municipalities: MunicipalityEntry[] }) => {
        if (!cancelled) setMunicipalities(data.municipalities ?? []);
      })
      .catch(() => {
        if (!cancelled) setMunicipalities([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMunicipalities(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jpPrefecture.code]);

  const selectedMunicipality = municipalities.find((m) => m.code === selectedCode) ?? null;

  const handleAnalyze = async () => {
    if (!selectedMunicipality) return;
    setLoadingAnalysis(true);
    setAnalysisError(false);
    try {
      const centerRes = await fetch(
        `/api/geocoding/municipality-center?prefectureNameJa=${encodeURIComponent(jpPrefecture.nameJa)}&municipalityNameJa=${encodeURIComponent(selectedMunicipality.nameJa)}`,
      );
      const centerData: { point: { latitude: number; longitude: number } | null } = await centerRes.json();
      const point = centerData.point;
      setCenterPoint(point);

      const [popRes, hhRes, rateRes] = await Promise.all([
        fetch(`/api/estat?municipalityCode=${selectedMunicipality.code}&indicator=population`),
        fetch(`/api/estat?municipalityCode=${selectedMunicipality.code}&indicator=households`),
        fetch(`/api/estat?municipalityCode=${selectedMunicipality.code}&indicator=population_change_rate`),
      ]);
      const popData: EstatResult = await popRes.json();
      const hhData: EstatResult = await hhRes.json();
      const rateData: EstatResult = await rateRes.json();
      setPopulation(popData);
      setHouseholds(hhData);
      setChangeRate(rateData);

      let hazardResults: HazardFetchResult[] = [];
      let amenityResults: AmenityFetchResult[] = [];
      let stationResult: StationFetchResult | null = null;

      if (point) {
        const hazardResponses = await Promise.all(
          HAZARD_CATEGORIES.map((category) =>
            fetch(`/api/hazard?category=${category}&latitude=${point.latitude}&longitude=${point.longitude}`).then(
              (r) => r.json(),
            ),
          ),
        );
        hazardResults = HAZARD_CATEGORIES.map((category, i) => ({
          category,
          status: hazardResponses[i].status,
        }));
        setHazards(hazardResults);

        const amenityResponses = await Promise.all(
          AMENITY_CATEGORIES.map((category) =>
            fetch(`/api/amenities?category=${category}&latitude=${point.latitude}&longitude=${point.longitude}`).then(
              (r) => r.json(),
            ),
          ),
        );
        amenityResults = AMENITY_CATEGORIES.map((category, i) => {
          const res = amenityResponses[i];
          const nearest = res.amenities?.[0] ?? null;
          return {
            category,
            status: res.status,
            nearestName: nearest?.name ?? null,
            nearestDistanceMeters: nearest?.distanceMeters ?? null,
          };
        });
        setAmenities(amenityResults);

        const stationRes = await fetch(`/api/stations?latitude=${point.latitude}&longitude=${point.longitude}`).then(
          (r) => r.json(),
        );
        const nearest = stationRes.stations?.[0] ?? null;
        const nearestJr = (stationRes.stations ?? []).find((s: { info: { operator: string } }) =>
          s.info.operator.startsWith("JR"),
        );
        stationResult = {
          status: stationRes.status,
          nearestName: nearest?.info?.name ?? null,
          nearestOperator: nearest?.info?.operator ?? null,
          nearestLine: nearest?.info?.line ?? null,
          nearestDistanceMeters: nearest?.distanceMeters ?? null,
          nearestJrDistanceMeters: nearestJr?.distanceMeters ?? null,
        };
        setStation(stationResult);
      } else {
        setHazards([]);
        setAmenities([]);
        setStation(null);
      }

      const score = computeCityScore({
        populationChangeRatePercent:
          rateData.status === "AVAILABLE" && rateData.data ? rateData.data.value : null,
        hazards: hazardResults,
        amenities: amenityResults.map((a) => ({
          category: a.category,
          status: a.status,
          nearestDistanceMeters: a.nearestDistanceMeters,
        })),
        station: stationResult
          ? {
              status: stationResult.status,
              nearestDistanceMeters: stationResult.nearestDistanceMeters,
              nearestJrDistanceMeters: stationResult.nearestJrDistanceMeters,
            }
          : null,
      });
      setCityScore(score);
    } catch {
      setAnalysisError(true);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">🏙️ La ville</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Analyse d&apos;une commune réelle — démographie (e-Stat), risques naturels, services de proximité et gares
        (MLIT) — sans avoir besoin d&apos;avoir déjà trouvé un bien précis.
      </p>

      <Card className="border-border p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Préfecture (47 disponibles)</p>
            <Select value={jpPrefecture.code} onValueChange={onChangePrefecture}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JAPAN_PREFECTURES.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.nameJa} ({p.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Commune</p>
            <Select
              value={selectedCode ?? ""}
              onValueChange={(v) => setSelectedCode(v)}
              disabled={loadingMunicipalities || municipalities.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={loadingMunicipalities ? "Chargement des communes..." : "Choisir une commune"}
                />
              </SelectTrigger>
              <SelectContent>
                {municipalities.map((m) => (
                  <SelectItem key={m.code} value={m.code}>
                    {m.nameJa} ({m.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleAnalyze} disabled={!selectedMunicipality || loadingAnalysis}>
            {loadingAnalysis ? "Analyse..." : "🔍 Analyser la ville"}
          </Button>
        </div>

        {analysisError && (
          <p className="mt-3 text-xs text-destructive">Impossible d&apos;analyser cette commune actuellement.</p>
        )}

        {centerPoint === null && cityScore !== null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Point de centre-ville non résolu : seule la démographie e-Stat (basée sur le code municipal, pas sur des
            coordonnées) a pu être consultée.
          </p>
        )}

        {centerPoint && (
          <p className="mt-3 text-xs text-muted-foreground">
            Point de référence : centre approximatif de {selectedMunicipality?.nameJa} (
            {centerPoint.latitude.toFixed(4)}, {centerPoint.longitude.toFixed(4)}), résolu via le géocodeur public du
            GSI (国土地理院) — pas l&apos;adresse d&apos;un bien précis.
          </p>
        )}
      </Card>

      {cityScore && (
        <Card className="mt-4 border-border p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Note de la ville</p>
            {cityScore.score !== null ? (
              <span className="text-2xl font-semibold text-foreground">{cityScore.score}/100</span>
            ) : (
              <span className="text-sm text-muted-foreground">Non calculable</span>
            )}
          </div>
          {cityScore.coverageIncomplete && (
            <p className="mb-3 text-xs text-amber-700">
              ⚠️ Couverture partielle : seul(s) {cityScore.axes.length}/4 axe(s) a (ont) pu être mesuré(s). La note
              ne reflète que les axes disponibles, jamais une estimation des axes manquants.
            </p>
          )}
          <ul className="space-y-2">
            {cityScore.axes.map((axis) => (
              <li key={axis.key} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{axis.label}</span>
                  <span className="text-foreground">{axis.score}/10</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{axis.justification}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(population || households || changeRate) && (
        <Card className="mt-4 border-border p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            🏘️ Démographie — e-Stat (recensement réel par commune)
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Population</p>
              {population?.status === "AVAILABLE" && population.data ? (
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {population.data.value.toLocaleString("fr-FR")}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">({population.data.period})</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Non disponible</p>
              )}
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Ménages</p>
              {households?.status === "AVAILABLE" && households.data ? (
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {households.data.value.toLocaleString("fr-FR")}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">({households.data.period})</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Non disponible</p>
              )}
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Évolution</p>
              {changeRate?.status === "AVAILABLE" && changeRate.data ? (
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {changeRate.data.value > 0 ? "+" : ""}
                  {changeRate.data.value.toFixed(2)}%
                  <span className="ml-1 text-xs font-normal text-muted-foreground">({changeRate.data.period})</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Non disponible</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {hazards.length > 0 && (
        <Card className="mt-4 border-border p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            ⚠️ Risques naturels — MLIT (centre-ville approximatif)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {hazards.map((h) => (
              <div
                key={h.category}
                className={`rounded-md border p-3 text-sm ${
                  h.status === "IN_ZONE" ? "border-amber-600/30 bg-amber-600/5" : "border-border"
                }`}
              >
                <span className="font-medium text-foreground">{HAZARD_CATEGORY_LABELS[h.category]}</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {h.status === "IN_ZONE"
                    ? "Dans une zone de risque documentée."
                    : h.status === "OUTSIDE_ZONE"
                      ? "Hors zone de risque documentée."
                      : "Donnée indisponible."}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {amenities.length > 0 && (
        <Card className="mt-4 border-border p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            🏫 Services de proximité — MLIT (centre-ville approximatif)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {amenities.map((a) => (
              <div key={a.category} className="rounded-md border border-border p-3 text-sm">
                <span className="font-medium text-foreground">{AMENITY_CATEGORY_LABELS[a.category]}</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.status === "FOUND" && a.nearestName && a.nearestDistanceMeters !== null
                    ? `${a.nearestName} — ${formatDistance(a.nearestDistanceMeters)}`
                    : a.status === "NONE_IN_TILE"
                      ? "Aucun trouvé dans la zone consultée."
                      : "Donnée indisponible."}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {station && (
        <Card className="mt-4 border-border p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            🚉 Gare la plus proche — MLIT (centre-ville approximatif)
          </p>
          {station.status === "FOUND" && station.nearestName && station.nearestDistanceMeters !== null ? (
            <p className="text-sm text-foreground">
              {station.nearestName} ({station.nearestLine}, {station.nearestOperator}) —{" "}
              {formatDistance(station.nearestDistanceMeters)}
              {station.nearestOperator?.startsWith("JR") && (
                <span className="ml-2 text-xs font-medium text-emerald-700">Ligne JR</span>
              )}
            </p>
          ) : station.status === "NONE_IN_TILE" ? (
            <p className="text-sm text-muted-foreground">Aucune gare trouvée dans la zone consultée.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Donnée indisponible.</p>
          )}
        </Card>
      )}
    </motion.section>
  );
}

// L'onglet a son propre choix de préfecture (les 47), indépendant de la
// région d'investissement curatée choisie à l'étape 2 (`prefecture`,
// limitée aux 18 régions de data/regions.json) — pré-rempli avec elle
// quand elle correspond à une préfecture réelle connue, mais librement
// modifiable ensuite : explorer une ville ne doit pas dépendre d'avoir
// déjà choisi une région d'investissement, ni s'y limiter.
export function CitySection({ prefecture }: CitySectionProps) {
  const suggestedCode = findPrefectureByRegionLabel(prefecture ?? "")?.code ?? null;
  const [selectedCode, setSelectedCode] = useState<string | null>(suggestedCode);

  // Pattern React officiel pour ajuster un état dérivé d'une prop qui
  // change (https://react.dev/learn/you-might-not-need-an-effect) : un
  // setState conditionnel pendant le rendu, jamais dans un effet — évite
  // le rendu superflu d'un effet après coup tout en ne réinitialisant le
  // choix de préfecture QUE lorsque la région d'étape 2 change vraiment
  // (jamais quand l'utilisateur a choisi une autre préfecture ici).
  const [lastSuggestedCode, setLastSuggestedCode] = useState(suggestedCode);
  if (suggestedCode !== lastSuggestedCode) {
    setLastSuggestedCode(suggestedCode);
    setSelectedCode(suggestedCode);
  }

  const jpPrefecture = JAPAN_PREFECTURES.find((p) => p.code === selectedCode) ?? null;

  if (!jpPrefecture) {
    return (
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">🏙️ La ville</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Analysez n&apos;importe quelle commune du Japon — démographie, risques naturels, services de proximité et
          gares — sans avoir besoin d&apos;avoir déjà trouvé un bien précis.
        </p>
        <Card className="border-border p-6">
          <p className="mb-2 text-xs text-muted-foreground">Préfecture (47 disponibles)</p>
          <Select value="" onValueChange={setSelectedCode}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une préfecture" />
            </SelectTrigger>
            <SelectContent>
              {JAPAN_PREFECTURES.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.nameJa} ({p.label})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      </motion.section>
    );
  }

  return <CityExplorer key={jpPrefecture.code} jpPrefecture={jpPrefecture} onChangePrefecture={setSelectedCode} />;
}
