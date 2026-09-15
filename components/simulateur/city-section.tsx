"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { groupMunicipalitiesByType, MUNICIPALITY_TYPE_LABELS } from "@/lib/mlit/municipality-type";
import { findPrefectureByRegionLabel, JAPAN_PREFECTURES, type JapanPrefecture } from "@/lib/japan-prefectures";
import type { MunicipalityEntry } from "@/lib/mlit/municipalities-provider";
import { HAZARD_CATEGORY_LABELS } from "@/lib/hazard-contract";
import type { PolygonHazardCategory } from "@/lib/hazard/provider";
import { AMENITY_CATEGORY_LABELS, type AmenityCategory } from "@/lib/amenities/provider";
import {
  computeCityScore,
  type CityScoreAxis,
  type CityScoreAxisKey,
  type CityScoreCategory,
  type CityScorePriorities,
  type CityScorePriority,
} from "@/lib/city-score";
import type { EstatResult } from "@/lib/estat-contract";
import { computeAveragePricePerSqm, recentQuarters, type AveragePricePerSqm } from "@/lib/mlit/price-stats";
import { computeAverageLandPricePerSqm, type AverageLandPricePerSqm } from "@/lib/mlit/land-price-stats";
import type { MlitTransaction } from "@/lib/mlit/types";
import type { OfficialLandPricePoint } from "@/lib/mlit/land-price-types";
import type { ConstructionCostData } from "@/lib/estat/construction-cost-provider";
import { jpyToEur } from "@/lib/data";
import { formatEur, formatJpy } from "@/lib/format";

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

const PRIORITY_AXIS_LABELS: Record<CityScoreAxisKey, string> = {
  demographie: "Démographie",
  risques: "Risques naturels",
  services: "Services de proximité",
  gare: "Gare & réseau ferré",
};

// Épinglé pour comparaison — vit dans CitySection (jamais dans
// CityExplorer, qui est remonté à chaque changement de préfecture) afin
// de pouvoir comparer des communes de préfectures DIFFÉRENTES entre
// elles, pas seulement au sein d'une même préfecture.
export interface PinnedCity {
  prefectureLabel: string;
  municipalityCode: string;
  municipalityName: string;
  score: number | null;
  category: CityScoreCategory | null;
  axes: CityScoreAxis[];
}

export interface UseCityPayload {
  city: string;
  municipalityCode: string;
}

interface CitySectionProps {
  prefecture: string | null;
  // Bridge vers "Bien réel trouvé" (real-listing-section.tsx) : ne
  // transmet JAMAIS le point de centre-ville GSI comme coordonnées —
  // seuls la ville et le code municipal (tous deux exacts, vérifiés)
  // sont propagés. computeGeographicPrecision traiterait tout lat/long
  // non-null comme "EXACT" (précision d'adresse), ce qu'un centre-ville
  // approximatif n'est pas : le bien reste donc à précision
  // "MUNICIPALITY" tant que l'utilisateur ne renseigne pas une adresse
  // réelle, ce qui est honnête.
  onUseCity?: (payload: UseCityPayload) => void;
}

// CityExplorer est remonté (via `key`) à chaque changement de préfecture
// plutôt que de réinitialiser manuellement chaque état dans un effet —
// évite les rendus en cascade d'un setState synchrone dans un effet, et
// garantit qu'aucun état d'une préfecture précédente ne survit au
// changement.
function CityExplorer({
  jpPrefecture,
  onChangePrefecture,
  pinnedCodes,
  onTogglePin,
  onUseCity,
}: {
  jpPrefecture: JapanPrefecture;
  onChangePrefecture: (code: string | null) => void;
  pinnedCodes: Set<string>;
  onTogglePin: (snapshot: PinnedCity) => void;
  onUseCity?: (payload: UseCityPayload) => void;
}) {
  const [municipalities, setMunicipalities] = useState<MunicipalityEntry[]>([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState(false);
  const [centerPoint, setCenterPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [population, setPopulation] = useState<EstatResult | null>(null);
  const [households, setHouseholds] = useState<EstatResult | null>(null);
  const [changeRate, setChangeRate] = useState<EstatResult | null>(null);
  const [hazards, setHazards] = useState<HazardFetchResult[]>([]);
  const [amenities, setAmenities] = useState<AmenityFetchResult[]>([]);
  const [station, setStation] = useState<StationFetchResult | null>(null);
  const [priorities, setPriorities] = useState<CityScorePriorities>({});
  const [transactionStats, setTransactionStats] = useState<AveragePricePerSqm | null>(null);
  const [transactionPeriod, setTransactionPeriod] = useState<string | null>(null);
  const [landPriceStats, setLandPriceStats] = useState<AverageLandPricePerSqm | null>(null);
  const [landPriceYear, setLandPriceYear] = useState<number | null>(null);
  const [constructionCost, setConstructionCost] = useState<ConstructionCostData | null>(null);

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
  const groupedMunicipalities = useMemo(() => groupMunicipalitiesByType(municipalities), [municipalities]);

  const handleAnalyze = async () => {
    if (!selectedMunicipality) return;
    setLoadingAnalysis(true);
    setAnalysisError(false);
    try {
      setAnalysisStep("Résolution du centre-ville (GSI)...");
      const centerRes = await fetch(
        `/api/geocoding/municipality-center?prefectureNameJa=${encodeURIComponent(jpPrefecture.nameJa)}&municipalityNameJa=${encodeURIComponent(selectedMunicipality.nameJa)}`,
      );
      const centerData: { point: { latitude: number; longitude: number } | null } = await centerRes.json();
      const point = centerData.point;
      setCenterPoint(point);

      setAnalysisStep("Démographie (e-Stat)...");
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
        setAnalysisStep("Risques naturels (MLIT)...");
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

        setAnalysisStep("Services de proximité (MLIT)...");
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

        setAnalysisStep("Gare la plus proche (MLIT)...");
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

      // Prix moyen réel au m² (transactions XIT001 récentes) — ne
      // nécessite que le code municipal, pas le point de centre-ville.
      setAnalysisStep("Prix des transactions récentes (MLIT)...");
      const quarters = recentQuarters(new Date(), 4);
      const txResponses = await Promise.all(
        quarters.map((q) =>
          fetch(
            `/api/mlit/transactions?municipalityCode=${selectedMunicipality.code}&year=${q.year}&quarter=${q.quarter}`,
          ).then((r) => r.json()),
        ),
      );
      const allTransactions: MlitTransaction[] = txResponses.flatMap((r) =>
        r.status === "AVAILABLE" ? (r.data ?? []) : [],
      );
      setTransactionStats(computeAveragePricePerSqm(allTransactions));
      setTransactionPeriod(
        `${quarters[quarters.length - 1].year}T${quarters[quarters.length - 1].quarter} → ${quarters[0].year}T${quarters[0].quarter}`,
      );

      // Prix foncier officiel moyen (XPT002) — nécessite le point de
      // centre-ville ; essaie l'année courante puis l'année précédente,
      // les millésimes de地価公示 étant publiés avec un décalage.
      if (point) {
        setAnalysisStep("Prix officiel du terrain (MLIT)...");
        const currentYear = new Date().getFullYear();
        let landJson: { status: string; data?: OfficialLandPricePoint[] } = await fetch(
          `/api/mlit/land-price?latitude=${point.latitude}&longitude=${point.longitude}&year=${currentYear}`,
        ).then((r) => r.json());
        let landYear = currentYear;
        if (landJson.status !== "AVAILABLE" || !landJson.data || landJson.data.length === 0) {
          landJson = await fetch(
            `/api/mlit/land-price?latitude=${point.latitude}&longitude=${point.longitude}&year=${currentYear - 1}`,
          ).then((r) => r.json());
          landYear = currentYear - 1;
        }
        const landPoints = landJson.status === "AVAILABLE" ? (landJson.data ?? []) : [];
        const landStats = computeAverageLandPricePerSqm(landPoints);
        setLandPriceStats(landStats);
        setLandPriceYear(landStats ? landYear : null);
      } else {
        setLandPriceStats(null);
        setLandPriceYear(null);
      }

      // Coût de construction régional (référence, e-Stat) — nécessite
      // uniquement la préfecture.
      setAnalysisStep("Coût de construction régional (e-Stat)...");
      const constructionJson: { status: string; data?: ConstructionCostData } = await fetch(
        `/api/estat/construction-cost?prefectureCode=${jpPrefecture.code}`,
      ).then((r) => r.json());
      setConstructionCost(constructionJson.status === "AVAILABLE" ? (constructionJson.data ?? null) : null);
    } catch {
      setAnalysisError(true);
    } finally {
      setLoadingAnalysis(false);
      setAnalysisStep(null);
    }
  };

  // Dérivé des résultats déjà en mémoire (jamais un nouvel appel réseau)
  // — recalcule instantanément dès que l'utilisateur ajuste ses
  // priorités, sans redemander les données à MLIT/e-Stat.
  const cityScore = useMemo(() => {
    if (!changeRate && hazards.length === 0 && amenities.length === 0 && !station) return null;
    return computeCityScore(
      {
        populationChangeRatePercent: changeRate?.status === "AVAILABLE" && changeRate.data ? changeRate.data.value : null,
        hazards,
        amenities: amenities.map((a) => ({
          category: a.category,
          status: a.status,
          nearestDistanceMeters: a.nearestDistanceMeters,
        })),
        station: station
          ? {
              status: station.status,
              nearestDistanceMeters: station.nearestDistanceMeters,
              nearestJrDistanceMeters: station.nearestJrDistanceMeters,
            }
          : null,
      },
      priorities,
    );
  }, [changeRate, hazards, amenities, station, priorities]);

  const isPinned = selectedMunicipality ? pinnedCodes.has(selectedMunicipality.code) : false;

  const handleTogglePin = () => {
    if (!selectedMunicipality || !cityScore) return;
    onTogglePin({
      prefectureLabel: jpPrefecture.label,
      municipalityCode: selectedMunicipality.code,
      municipalityName: selectedMunicipality.nameJa,
      score: cityScore.score,
      category: cityScore.category,
      axes: cityScore.axes,
    });
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
            <p className="mb-2 text-xs text-muted-foreground">
              Commune
              {groupedMunicipalities.length > 0 && (
                <span className="ml-1">
                  (
                  {groupedMunicipalities
                    .map((g) => `${g.entries.length} ${MUNICIPALITY_TYPE_LABELS[g.type].split(" ")[0].toLowerCase()}`)
                    .join(", ")}
                  )
                </span>
              )}
            </p>
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
                {groupedMunicipalities.map((group) => (
                  <SelectGroup key={group.type}>
                    <SelectLabel>{MUNICIPALITY_TYPE_LABELS[group.type]}</SelectLabel>
                    {group.entries.map((m) => (
                      <SelectItem key={m.code} value={m.code}>
                        {m.nameJa} ({m.code})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedMunicipality || loadingAnalysis}>
            {loadingAnalysis ? "Analyse..." : "🔍 Analyser la ville"}
          </Button>
          {loadingAnalysis && analysisStep && (
            <span className="text-xs text-muted-foreground">{analysisStep}</span>
          )}
          {onUseCity && (
            <Button
              variant="outline"
              disabled={!selectedMunicipality}
              onClick={() =>
                selectedMunicipality &&
                onUseCity({ city: selectedMunicipality.nameJa, municipalityCode: selectedMunicipality.code })
              }
            >
              🏠 Utiliser cette commune pour mon projet
            </Button>
          )}
        </div>
        {onUseCity && selectedMunicipality && (
          <p className="mt-2 text-xs text-muted-foreground">
            Renseigne la ville et le code municipal dans « Bien réel trouvé » ci-dessous — jamais de coordonnées GPS
            (le centre-ville approximatif n&apos;est pas l&apos;adresse d&apos;un bien précis).
          </p>
        )}

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
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Note de la ville</p>
            <div className="flex items-center gap-3">
              {cityScore.score !== null ? (
                <span className="text-2xl font-semibold text-foreground">{cityScore.score}/100</span>
              ) : (
                <span className="text-sm text-muted-foreground">Non calculable</span>
              )}
              <Button variant={isPinned ? "default" : "outline"} size="sm" onClick={handleTogglePin}>
                {isPinned ? "📌 Épinglée" : "📌 Épingler pour comparer"}
              </Button>
            </div>
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

          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-1 text-xs font-medium text-foreground">🎯 Vos priorités (optionnel)</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Indiquez ce qui compte le plus pour vous — la note se recalcule instantanément, sans redemander les
              données.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(PRIORITY_AXIS_LABELS) as CityScoreAxisKey[]).map((key) => (
                <PriorityToggle
                  key={key}
                  label={PRIORITY_AXIS_LABELS[key]}
                  value={priorities[key]}
                  onChange={(value) =>
                    setPriorities((prev) => {
                      const next = { ...prev };
                      if (value) next[key] = value;
                      else delete next[key];
                      return next;
                    })
                  }
                />
              ))}
            </div>
            {Object.keys(priorities).length > 0 && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPriorities({})}>
                Réinitialiser mes priorités
              </Button>
            )}
          </div>
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

      {(transactionStats || landPriceStats || constructionCost) && (
        <Card className="mt-4 border-border p-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            💰 Marché immobilier & coûts de construction
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Trois sources réelles distinctes, jamais fusionnées en un seul chiffre — chacune mesure une chose
            différente. Aucune ne porte spécifiquement sur les akiya : MLIT et e-Stat ne distinguent pas les biens
            abandonnés dans leurs statistiques, ces chiffres décrivent le marché immobilier général de la commune.
          </p>
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Prix moyen des transactions récentes (MLIT, {transactionPeriod})
              </p>
              {transactionStats ? (
                <p className="mt-1 text-sm text-foreground">
                  {formatJpy(transactionStats.averagePricePerSqmJpy)}/m² (≈{" "}
                  {formatEur(jpyToEur(transactionStats.averagePricePerSqmJpy))}/m²)
                  <span className="ml-1 text-xs text-muted-foreground">
                    — {transactionStats.sampleSize} transaction(s) trouvée(s)
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Aucune transaction trouvée sur la période.</p>
              )}
              <p className="mt-2 rounded border border-amber-600/40 bg-amber-600/10 p-2 text-xs text-amber-800">
                ⚠️⚠️ (CE N&apos;EST PAS UN PRIX D&apos;AKIYA) — MLIT ne distingue pas les maisons abandonnées dans ses
                transactions : cette moyenne mélange TOUTES les ventes immobilières de la commune (maisons neuves,
                appartements, terrains à bâtir, biens en excellent état...). La plupart de ces ventes concernent des
                biens habitables ordinaires, pas des akiya — un akiya réel se négocie très généralement bien en
                dessous de cette moyenne. À utiliser uniquement comme repère de marché général de la commune, jamais
                comme estimation du prix d&apos;un akiya.
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Prix officiel moyen du terrain{landPriceYear ? ` (${landPriceYear}, MLIT)` : " (MLIT)"}
              </p>
              {landPriceStats ? (
                <p className="mt-1 text-sm text-foreground">
                  {formatJpy(landPriceStats.averagePricePerSqmJpy)}/m² (≈{" "}
                  {formatEur(jpyToEur(landPriceStats.averagePricePerSqmJpy))}/m²)
                  <span className="ml-1 text-xs text-muted-foreground">
                    — {landPriceStats.sampleSize} point(s) officiel(s) trouvé(s) à proximité
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Aucun point officiel trouvé à proximité.</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                ⚠️ Prix du TERRAIN NU officiel (hors bâti), pas non plus une estimation d&apos;akiya — un akiya inclut
                une maison souvent sans valeur marchande propre, parfois même un coût de démolition à déduire.
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Coût de construction neuve (bois) dans la préfecture
                {constructionCost ? ` (FY${constructionCost.fiscalYear}, e-Stat)` : " (e-Stat)"}
              </p>
              {constructionCost ? (
                <p className="mt-1 text-sm text-foreground">
                  {formatJpy(constructionCost.costPerSqmJpy)}/m² (≈{" "}
                  {formatEur(jpyToEur(constructionCost.costPerSqmJpy))}/m²)
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Non disponible.</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                ⚠️ Statistique de construction NEUVE (mises en chantier), pas de rénovation — donnée pour référence
                de coût régional, jamais utilisée dans le calcul de l&apos;enveloppe travaux (forfaits nationaux
                séparés : léger/standard/lourd).
              </p>
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

function PriorityToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CityScorePriority | undefined;
  onChange: (value: CityScorePriority | undefined) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
      <span className="text-foreground">{label}</span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange(value === "peu_importe" ? undefined : "peu_importe")}
          className={`rounded px-2 py-1 ${
            value === "peu_importe"
              ? "bg-muted-foreground/20 font-medium text-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Peu importe
        </button>
        <button
          type="button"
          onClick={() => onChange(value === "important" ? undefined : "important")}
          className={`rounded px-2 py-1 ${
            value === "important" ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Important
        </button>
      </div>
    </div>
  );
}

// L'onglet a son propre choix de préfecture (les 47), indépendant de la
// région d'investissement curatée choisie à l'étape 2 (`prefecture`,
// limitée aux 18 régions de data/regions.json) — pré-rempli avec elle
// quand elle correspond à une préfecture réelle connue, mais librement
// modifiable ensuite : explorer une ville ne doit pas dépendre d'avoir
// déjà choisi une région d'investissement, ni s'y limiter.
const MAX_PINNED_CITIES = 5;
const PINNED_CITIES_STORAGE_KEY = "akiya-dream-ville-comparatif";

function readPinnedCitiesFromStorage(): PinnedCity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINNED_CITIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Lecture du comparatif de villes depuis localStorage impossible:", err);
    return [];
  }
}

export function CitySection({ prefecture, onUseCity }: CitySectionProps) {
  const suggestedCode = findPrefectureByRegionLabel(prefecture ?? "")?.code ?? null;
  const [selectedCode, setSelectedCode] = useState<string | null>(suggestedCode);
  // Lu une seule fois au montage (localStorage n'existe pas côté serveur
  // ; lazy initializer pour éviter de le lire à chaque rendu) — persiste
  // pour ne jamais perdre un comparatif en cours suite à un rechargement
  // accidentel de la page.
  const [pinnedCities, setPinnedCities] = useState<PinnedCity[]>(() => readPinnedCitiesFromStorage());

  useEffect(() => {
    try {
      window.localStorage.setItem(PINNED_CITIES_STORAGE_KEY, JSON.stringify(pinnedCities));
    } catch (err) {
      console.error("Écriture du comparatif de villes dans localStorage impossible:", err);
    }
  }, [pinnedCities]);

  // Vit ici (jamais dans CityExplorer, remonté à chaque changement de
  // préfecture) : permet de comparer des communes de préfectures
  // différentes — l'usage typique de quelqu'un qui explore plusieurs
  // pistes sans bien précis en tête.
  const handleTogglePin = (snapshot: PinnedCity) => {
    setPinnedCities((prev) => {
      const exists = prev.some((c) => c.municipalityCode === snapshot.municipalityCode);
      if (exists) return prev.filter((c) => c.municipalityCode !== snapshot.municipalityCode);
      if (prev.length >= MAX_PINNED_CITIES) return prev;
      return [...prev, snapshot];
    });
  };
  const pinnedCodes = useMemo(() => new Set(pinnedCities.map((c) => c.municipalityCode)), [pinnedCities]);

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

  return (
    <>
      <CityExplorer
        key={jpPrefecture.code}
        jpPrefecture={jpPrefecture}
        onChangePrefecture={setSelectedCode}
        pinnedCodes={pinnedCodes}
        onTogglePin={handleTogglePin}
        onUseCity={onUseCity}
      />
      {pinnedCities.length > 0 && (
        <CityComparisonTable cities={pinnedCities} onRemove={handleTogglePin} />
      )}
    </>
  );
}

// Comparatif des communes épinglées — pense au visiteur qui n'a aucun
// bien en tête et hésite entre plusieurs pistes : chaque "Analyser la
// ville" écraserait sinon le résultat précédent, rendant impossible
// toute comparaison entre deux communes, a fortiori de préfectures
// différentes.
function CityComparisonTable({ cities, onRemove }: { cities: PinnedCity[]; onRemove: (city: PinnedCity) => void }) {
  const allAxisKeys = Array.from(new Set(cities.flatMap((c) => c.axes.map((a) => a.key)))) as CityScoreAxisKey[];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-4"
    >
      <Card className="border-border p-6">
        <p className="mb-1 text-sm font-medium text-foreground">🔍 Comparatif des communes épinglées</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Jusqu&apos;à {MAX_PINNED_CITIES} communes, même de préfectures différentes — utile pour comparer plusieurs
          pistes sans devoir choisir tout de suite.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Commune</th>
                <th className="py-2 pr-3">Note</th>
                {allAxisKeys.map((key) => (
                  <th key={key} className="py-2 pr-3">
                    {PRIORITY_AXIS_LABELS[key]}
                  </th>
                ))}
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {cities.map((city) => (
                <tr key={city.municipalityCode} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">
                    <span className="font-medium text-foreground">{city.municipalityName}</span>
                    <span className="ml-1 text-xs text-muted-foreground">({city.prefectureLabel})</span>
                  </td>
                  <td className="py-2 pr-3 font-medium text-foreground">
                    {city.score !== null ? `${city.score}/100` : "—"}
                  </td>
                  {allAxisKeys.map((key) => {
                    const axis = city.axes.find((a) => a.key === key);
                    return (
                      <td key={key} className="py-2 pr-3 text-muted-foreground">
                        {axis ? `${axis.score}/10` : "—"}
                      </td>
                    );
                  })}
                  <td className="py-2">
                    <Button variant="ghost" size="sm" onClick={() => onRemove(city)}>
                      Retirer
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.section>
  );
}
