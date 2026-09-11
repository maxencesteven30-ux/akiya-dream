"use client";

import { useState } from "react";
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
import { computeEstimatedPriceFromSurface } from "@/lib/calculations";
import { formatJpy } from "@/lib/format";
import type { ListingCondition, RealListing } from "@/lib/types";

const CONDITION_OPTIONS: { value: ListingCondition; label: string }[] = [
  { value: "unknown", label: "Non renseigné" },
  { value: "good", label: "Bon état" },
  { value: "fair", label: "État correct" },
  { value: "needs_renovation", label: "Travaux à prévoir" },
  { value: "major_renovation", label: "Rénovation lourde nécessaire" },
];

interface RealListingSectionProps {
  realListing: RealListing | null;
  onChange: (listing: RealListing | null) => void;
  onApplyEstimatedPrice?: (priceJpy: number) => void;
}

const EMPTY_LISTING: RealListing = {
  name: "",
  city: "",
  surfaceM2: null,
  landM2: null,
  constructionYear: null,
  stationDistanceKm: null,
  condition: "unknown",
};

function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function RealListingSection({
  realListing,
  onChange,
  onApplyEstimatedPrice,
}: RealListingSectionProps) {
  const [open, setOpen] = useState(realListing !== null);
  const listing = realListing ?? EMPTY_LISTING;

  const update = (patch: Partial<RealListing>) => {
    onChange({ ...listing, ...patch });
  };

  const estimatedPriceJpy =
    listing.constructionYear && listing.surfaceM2
      ? computeEstimatedPriceFromSurface(listing.constructionYear, listing.surfaceM2)
      : null;

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          J&apos;ai trouvé un bien précis
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
              Bien réel trouvé
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ces informations affinent le nom du projet et les points de vigilance
              (l&apos;année de construction et la distance à la gare, quand vous les
              renseignez, remplacent les moyennes régionales par des données précises
              pour ce bien).
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              onChange(null);
            }}
          >
            Retirer
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="listing-name" className="mb-2 block">
              Nom du projet
            </Label>
            <Input
              id="listing-name"
              placeholder="ex. Maison à Tsuwano"
              value={listing.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="listing-city" className="mb-2 block">
              Ville
            </Label>
            <Input
              id="listing-city"
              placeholder="ex. Tsuwano"
              value={listing.city}
              onChange={(e) => update({ city: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="listing-surface" className="mb-2 block">
              Surface habitable (m²)
            </Label>
            <Input
              id="listing-surface"
              type="number"
              min={0}
              value={listing.surfaceM2 ?? ""}
              onChange={(e) => update({ surfaceM2: parseNumber(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="listing-land" className="mb-2 block">
              Terrain (m²)
            </Label>
            <Input
              id="listing-land"
              type="number"
              min={0}
              value={listing.landM2 ?? ""}
              onChange={(e) => update({ landM2: parseNumber(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="listing-year" className="mb-2 block">
              Année de construction
            </Label>
            <Input
              id="listing-year"
              type="number"
              min={1850}
              max={2026}
              placeholder="ex. 1975"
              value={listing.constructionYear ?? ""}
              onChange={(e) => update({ constructionYear: parseNumber(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="listing-distance" className="mb-2 block">
              Distance à la gare la plus proche (km)
            </Label>
            <Input
              id="listing-distance"
              type="number"
              min={0}
              value={listing.stationDistanceKm ?? ""}
              onChange={(e) => update({ stationDistanceKm: parseNumber(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="listing-condition" className="mb-2 block">
              État général
            </Label>
            <Select
              value={listing.condition}
              onValueChange={(v) => v && update({ condition: v as ListingCondition })}
            >
              <SelectTrigger id="listing-condition" className="w-full">
                <SelectValue>
                  {(value: ListingCondition) =>
                    CONDITION_OPTIONS.find((o) => o.value === value)?.label ?? value
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {estimatedPriceJpy !== null && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-accent/30 p-3 text-sm">
            <p className="text-muted-foreground">
              Prix estimé selon la surface et l&apos;ère du bâtiment :{" "}
              <span className="font-medium text-foreground">{formatJpy(estimatedPriceJpy)}</span>{" "}
              — une proposition indicative, pas une donnée mesurée pour ce bien.
            </p>
            {onApplyEstimatedPrice && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onApplyEstimatedPrice(estimatedPriceJpy)}
              >
                Utiliser cette estimation
              </Button>
            )}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
