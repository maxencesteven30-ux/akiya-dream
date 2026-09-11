"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  calculateAnnualCosts,
  computeBudget,
  computeBudgetScenarios,
  computeRiskFlags,
} from "@/lib/calculations";
import type { ScenarioLabel } from "@/lib/calculations";
import { Money } from "@/components/simulateur/money";
import { jpyToEur } from "@/lib/data";
import { formatEur, formatJpy } from "@/lib/format";
import type { BuyerProfile, RealListing, Region, RenovationLevel } from "@/lib/types";

interface ResultatSectionProps {
  housePriceJpy: number;
  region: Region | null;
  profile: BuyerProfile | null;
  renovationLevel: RenovationLevel | null;
  realListing: RealListing | null;
}

const SEGMENT_COLORS = {
  maison: "#D9D3C7",
  acquisition: "#3D3935",
  travaux: "#A0522D",
} as const;

export function ResultatSection({
  housePriceJpy,
  region,
  profile,
  renovationLevel,
  realListing,
}: ResultatSectionProps) {
  const ready = Boolean(profile && region && renovationLevel);

  const refinement = useMemo(() => {
    if (!realListing?.constructionYear || !realListing?.surfaceM2) return null;
    return {
      constructionYear: realListing.constructionYear,
      surfaceM2: realListing.surfaceM2,
    };
  }, [realListing]);

  const budget = useMemo(() => {
    if (!profile || !renovationLevel) return null;
    return computeBudget(housePriceJpy, profile, renovationLevel, refinement);
  }, [housePriceJpy, profile, renovationLevel, refinement]);

  const chartData = useMemo(() => {
    if (!budget) return [];
    return [
      {
        name: "Budget",
        maison: budget.prixAchatJpy,
        acquisition: budget.acquisitionFees.total,
        travaux: budget.travauxJpy,
      },
    ];
  }, [budget]);

  const annualCosts = useMemo(() => {
    if (!profile) return null;
    return calculateAnnualCosts(housePriceJpy, profile);
  }, [housePriceJpy, profile]);

  const scenarios = useMemo(() => {
    if (!profile || !renovationLevel) return null;
    return computeBudgetScenarios(housePriceJpy, profile, renovationLevel, refinement);
  }, [housePriceJpy, profile, renovationLevel, refinement]);

  const riskFlags = useMemo(() => {
    if (!profile || !renovationLevel) return [];
    return computeRiskFlags(
      profile,
      renovationLevel,
      region,
      realListing?.constructionYear,
      realListing?.stationDistanceKm,
    );
  }, [profile, renovationLevel, region, realListing]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Étape 3 — Le choc de réalité
      </h2>
      <div className="mb-1 flex items-center gap-2">
        <p className="text-lg text-foreground">
          {realListing?.name ? realListing.name : "Du prix affiché au coût réel"}
        </p>
        {region && (
          <Badge variant="secondary" className="font-normal">
            {region.prefecture.replace(/_/g, " ")} — niveau {region.recommendationLevel}
          </Badge>
        )}
        {budget?.surfaceBasedRenovation?.eraCode === "PRE_1981" && (
          <Badge variant="destructive" className="font-normal">
            ⚠️ Bâtiment pré-1981
          </Badge>
        )}
      </div>
      {budget?.surfaceBasedRenovation?.eraCode === "PRE_1981" && (
        <p className="mb-2 text-sm text-destructive">
          Mise aux normes sismiques et isolation renforcée obligatoires — voir le détail des
          travaux ci-dessous.
        </p>
      )}
      <p className="mb-5 text-sm text-muted-foreground">
        {[
          realListing?.city || null,
          realListing?.surfaceM2 ? `${realListing.surfaceM2} m² habitables` : null,
          realListing?.landM2 ? `${realListing.landM2} m² de terrain` : null,
          realListing?.constructionYear ? `construit en ${realListing.constructionYear}` : null,
          realListing?.stationDistanceKm !== null && realListing?.stationDistanceKm !== undefined
            ? `${realListing.stationDistanceKm} km de la gare`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || " "}
      </p>

      <Card className="border-border p-6 sm:p-8">
        {!ready || !budget ? (
          <p className="text-sm text-muted-foreground">
            Complétez les étapes 1 et 2 pour voir apparaître la ventilation des coûts.
          </p>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2 sm:items-end">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Coût réel total
                </p>
                <p className="text-3xl font-semibold text-foreground">
                  {formatJpy(budget.totalProjetJpy)}
                </p>
                <p className="text-sm text-muted-foreground">
                  soit {formatEur(budget.totalProjetEur)}
                </p>
              </div>
              <Legend budget={budget} />
            </div>

            <ResponsiveContainer width="100%" height={140} minWidth={0}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                />
                <Bar dataKey="maison" stackId="budget" fill={SEGMENT_COLORS.maison}>
                  <Cell fill={SEGMENT_COLORS.maison} stroke="var(--border)" strokeWidth={1} />
                </Bar>
                <Bar dataKey="acquisition" stackId="budget" fill={SEGMENT_COLORS.acquisition}>
                  <Cell fill={SEGMENT_COLORS.acquisition} />
                </Bar>
                <Bar dataKey="travaux" stackId="budget" fill={SEGMENT_COLORS.travaux}>
                  <Cell fill={SEGMENT_COLORS.travaux} stroke="var(--border)" strokeWidth={1} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <DetailBreakdown budget={budget} />
            {scenarios && <ScenarioComparison scenarios={scenarios} />}
          </div>
        )}
      </Card>

      {ready && riskFlags.length > 0 && (
        <div className="mt-6">
          <RiskCheckerCard riskFlags={riskFlags} />
        </div>
      )}

      {ready && annualCosts && profile && (
        <div className="mt-6">
          <AnnualCostsCard annualCosts={annualCosts} profile={profile} />
        </div>
      )}
    </motion.section>
  );
}

const SEGMENT_LABELS = {
  maison: "Prix de la maison",
  acquisition: "Frais d'acquisition",
  travaux: "Travaux",
} as const;

interface ChartTooltipPayloadEntry {
  dataKey?: string;
  value?: number;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <ul className="space-y-1">
        {payload.map((entry) => {
          const key = entry.dataKey as keyof typeof SEGMENT_COLORS;
          if (!key) return null;
          return (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                style={{ background: SEGMENT_COLORS[key] }}
              />
              <span className="text-muted-foreground">{SEGMENT_LABELS[key]}</span>
              <span className="ml-auto pl-3 text-right font-medium text-foreground">
                {formatJpy(Number(entry.value ?? 0))}
                <span className="block text-[10px] font-normal text-muted-foreground">
                  ≈ {formatEur(jpyToEur(Number(entry.value ?? 0)))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Legend({ budget }: { budget: ReturnType<typeof computeBudget> }) {
  const items = [
    { key: "maison", label: SEGMENT_LABELS.maison, value: budget.prixAchatJpy },
    {
      key: "acquisition",
      label: SEGMENT_LABELS.acquisition,
      value: budget.acquisitionFees.total,
    },
    { key: "travaux", label: SEGMENT_LABELS.travaux, value: budget.travauxJpy },
  ] as const;

  return (
    <ul className="space-y-1.5 sm:justify-self-end">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
            style={{ background: SEGMENT_COLORS[item.key] }}
          />
          <span className="text-muted-foreground">{item.label}</span>
          <Money jpy={item.value} className="ml-auto font-medium text-foreground" />
        </li>
      ))}
    </ul>
  );
}

function RiskCheckerCard({ riskFlags }: { riskFlags: ReturnType<typeof computeRiskFlags> }) {
  return (
    <Card className="border-border p-6 sm:p-8">
      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
        Points de vigilance
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        Signaux automatiques basés sur vos choix — ne remplacent pas un
        diagnostic professionnel.
      </p>
      <ul className="space-y-3 text-sm">
        {riskFlags.map((flag) => (
          <li key={flag.key} className="flex gap-2">
            <span aria-hidden="true">⚠️</span>
            <span className="text-foreground">{flag.message}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AnnualCostsCard({
  annualCosts,
  profile,
}: {
  annualCosts: ReturnType<typeof calculateAnnualCosts>;
  profile: BuyerProfile;
}) {
  const rows = [
    { label: "Taxe foncière (Kotei shisan-zei)", value: annualCosts.taxeFonciereJpy },
    { label: "Taxe d'urbanisme (Toshi keikaku-zei)", value: annualCosts.taxeUrbanismeJpy },
    { label: "Assurance habitation & séisme", value: annualCosts.assuranceJpy },
    { label: "Gestion à distance & entretien", value: annualCosts.gestionEntretienJpy },
    { label: "Comptable (Zeirishi — Gōdō Kaisha)", value: annualCosts.comptableJpy },
  ];

  return (
    <Card className="border-border p-6 sm:p-8">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Coût de possession sur 10 ans
        </p>
        <p className="text-3xl font-semibold text-foreground">
          {formatJpy(annualCosts.coutDixAnsJpy)}
        </p>
        <p className="text-sm text-muted-foreground">
          soit {formatEur(annualCosts.coutDixAnsEur)} — {formatJpy(annualCosts.totalAnnuelJpy)}
          {" "}/ an
        </p>
      </div>

      {profile === "investisseur" && (
        <Badge variant="destructive" className="mb-4">
          Gōdō Kaisha : {formatJpy(annualCosts.comptableJpy)} (≈{" "}
          {formatEur(jpyToEur(annualCosts.comptableJpy))}) de frais comptables s&apos;ajoutent
          chaque année
        </Badge>
      )}

      <Separator className="mb-2" />

      <Accordion defaultValue={["detail"]}>
        <AccordionItem value="detail">
          <AccordionTrigger className="text-sm text-muted-foreground">
            Détail de la charge annuelle
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1.5 text-sm">
              {rows.map((row) => (
                <li key={row.label} className="flex justify-between">
                  <span className="text-muted-foreground">{row.label}</span>
                  {row.value > 0 ? (
                    <Money jpy={row.value} className="text-foreground" />
                  ) : (
                    <span className="text-foreground">—</span>
                  )}
                </li>
              ))}
              <li className="flex justify-between border-t border-border pt-1.5 font-medium">
                <span className="text-foreground">Total annuel</span>
                <Money jpy={annualCosts.totalAnnuelJpy} className="text-foreground" />
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

const SCENARIO_LABELS: Record<ScenarioLabel, string> = {
  optimiste: "Optimiste",
  realiste: "Réaliste",
  prudent: "Prudent",
};

function ScenarioComparison({
  scenarios,
}: {
  scenarios: ReturnType<typeof computeBudgetScenarios>;
}) {
  return (
    <div className="border-t border-border pt-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Scénarios travaux
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Le total ci-dessus utilise l&apos;hypothèse optimiste (aucun dépassement).
        Réaliste et prudent appliquent une marge de dépassement sur les travaux
        (+10% / +20%) — hypothèse explicite, pas une donnée mesurée.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {scenarios.map((scenario) => (
          <div
            key={scenario.label}
            className="rounded-md border border-border p-3 text-sm"
          >
            <p className="mb-1 flex items-baseline justify-between">
              <span className="font-medium text-foreground">
                {SCENARIO_LABELS[scenario.label]}
              </span>
              <span className="text-xs text-muted-foreground">
                {scenario.multiplier === 1
                  ? "base"
                  : `+${Math.round((scenario.multiplier - 1) * 100)}%`}
              </span>
            </p>
            <p className="text-muted-foreground">
              Travaux : {formatJpy(scenario.travauxJpy)}{" "}
              <span className="text-xs">(≈ {formatEur(jpyToEur(scenario.travauxJpy))})</span>
            </p>
            <p className="text-foreground">
              Total : {formatJpy(scenario.totalProjetJpy)}
            </p>
            <p className="text-xs text-muted-foreground">
              soit {formatEur(scenario.totalProjetEur)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailBreakdown({ budget }: { budget: ReturnType<typeof computeBudget> }) {
  const surfaceBased = budget.surfaceBasedRenovation;

  const rows = [
    { label: "Prix d'achat", value: budget.prixAchatJpy },
    { label: "Frais d'agence (Fudōsan)", value: budget.acquisitionFees.agence },
    { label: "Shihō shoshi (juriste)", value: budget.acquisitionFees.juriste },
    { label: "Taxes (acquisition + enregistrement)", value: budget.acquisitionFees.taxes },
    { label: "Montage juridique", value: budget.acquisitionFees.montageJuridique },
    ...(surfaceBased
      ? [
          { label: "Isolation (au m², selon l'ère du bâtiment)", value: surfaceBased.isolationJpy },
          { label: "Climatisation / chauffage (HVAC, au m²)", value: surfaceBased.hvacJpy },
          ...(surfaceBased.majorationStructurelleJpy > 0
            ? [
                {
                  label: "Mise aux normes sismiques (structurel, PRE_1981)",
                  value: surfaceBased.majorationStructurelleJpy,
                },
              ]
            : []),
        ]
      : [{ label: "Travaux", value: budget.travauxJpy }]),
  ];

  return (
    <div className="border-t border-border pt-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Détail du calcul
      </p>
      {surfaceBased && (
        <p className="mb-3 text-xs text-muted-foreground">
          Travaux affinés à partir de la surface habitable et de l&apos;année de construction du
          bien réel renseigné (ère {surfaceBased.eraCode.replace(/_/g, " ")}), au lieu du forfait
          générique par niveau.
        </p>
      )}
      <ul className="space-y-1.5 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex justify-between">
            <span className="text-muted-foreground">{row.label}</span>
            {row.value > 0 ? (
              <Money jpy={row.value} className="text-foreground" />
            ) : (
              <span className="text-foreground">—</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
