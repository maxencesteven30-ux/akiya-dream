"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RealListing } from "@/lib/types";

interface RealListingSectionProps {
  realListing: RealListing | null;
  onChange: (listing: RealListing | null) => void;
}

const EMPTY_LISTING: RealListing = {
  name: "",
  city: "",
  surfaceM2: null,
  landM2: null,
  constructionYear: null,
  stationDistanceKm: null,
};

function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function RealListingSection({ realListing, onChange }: RealListingSectionProps) {
  const [open, setOpen] = useState(realListing !== null);
  const listing = realListing ?? EMPTY_LISTING;

  const update = (patch: Partial<RealListing>) => {
    onChange({ ...listing, ...patch });
  };

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
        </div>
      </Card>
    </motion.div>
  );
}
