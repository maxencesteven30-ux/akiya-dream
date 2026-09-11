"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NO_DATA_COLOR, valueToColor } from "@/lib/map-colors";
import { formatEur, formatJpy } from "@/lib/format";
import { jpyToEur } from "@/lib/data";
import type { Region, RegionAttributes } from "@/lib/types";

interface JapanMapProps {
  regions: Region[];
  regionAttributes: Record<string, RegionAttributes>;
  onSelectRegion: (prefecture: string) => void;
}

type MapMode = "prix" | "anciennete" | "aides" | "neige";

const MODE_LABELS: Record<MapMode, string> = {
  prix: "Prix médian",
  anciennete: "Ancienneté du parc (% pré-1981)",
  aides: "Subvention documentée",
  neige: "Neige moyenne / an",
};

// Classe CSS anglaise (fichier SVG geolonia/japanese-prefectures) -> nom
// de région tel qu'il existe dans notre table `regions`. Fukuoka_Periph
// et Hyogo_Rural (zones composites, non officielles) sont rattachées au
// contour de leur préfecture parente à titre indicatif uniquement : la
// forme représente toute la préfecture, pas la sous-zone exacte.
const PREFECTURE_CLASS_TO_REGION: Record<string, string> = {
  yamaguchi: "Yamaguchi",
  shimane: "Shimane",
  tottori: "Tottori",
  okayama: "Okayama",
  ehime: "Ehime",
  tokushima: "Tokushima",
  oita: "Oita",
  kumamoto: "Kumamoto",
  kagoshima: "Kagoshima",
  miyazaki: "Miyazaki",
  gifu: "Gifu",
  nagano: "Nagano",
  wakayama: "Wakayama",
  niigata: "Niigata",
  aomori: "Aomori",
  hokkaido: "Hokkaido",
  fukuoka: "Fukuoka_Periph",
  hyogo: "Hyogo_Rural",
};

const FROM_COLOR = "#F1EDE9";
const TO_COLOR = "#A0522D";

export function JapanMap({ regions, regionAttributes, onSelectRegion }: JapanMapProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<MapMode>("prix");
  const [hovered, setHovered] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgReady, setSvgReady] = useState(false);

  useEffect(() => {
    if (!open || svgReady) return;
    let ignore = false;
    fetch("/japan-prefectures-map.svg")
      .then((r) => r.text())
      .then((svg) => {
        if (ignore || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setSvgReady(true);
      })
      .catch((err: unknown) => console.error("JapanMap: failed to load SVG", err));
    return () => {
      ignore = true;
    };
  }, [open, svgReady]);

  const valuesByRegion = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const region of regions) {
      const attrs = regionAttributes[region.prefecture];
      let value: number | null;
      switch (mode) {
        case "prix":
          value = region.medianPriceJpy;
          break;
        case "anciennete":
          value = region.pre1981Percent;
          break;
        case "aides":
          value = region.subsidyMaxJpy;
          break;
        case "neige":
          value = attrs?.avgAnnualSnowfallCm ?? null;
          break;
      }
      map.set(region.prefecture, value);
    }
    return map;
  }, [regions, regionAttributes, mode]);

  const [min, max] = useMemo(() => {
    const values = Array.from(valuesByRegion.values()).filter(
      (v): v is number => v !== null,
    );
    if (values.length === 0) return [0, 1];
    return [Math.min(...values), Math.max(...values)];
  }, [valuesByRegion]);

  useEffect(() => {
    if (!svgReady || !containerRef.current) return;
    const groups = containerRef.current.querySelectorAll<SVGGElement>("g.prefecture");

    groups.forEach((g) => {
      const englishClass = Array.from(g.classList).find(
        (c) => c in PREFECTURE_CLASS_TO_REGION,
      );
      const regionName = englishClass ? PREFECTURE_CLASS_TO_REGION[englishClass] : undefined;
      const value = regionName ? (valuesByRegion.get(regionName) ?? null) : null;

      const color =
        regionName && value !== null
          ? valueToColor(value, min, max, FROM_COLOR, TO_COLOR)
          : NO_DATA_COLOR;

      g.style.fill = color;
      g.style.transition = "fill 150ms ease";

      if (regionName) {
        g.style.cursor = "pointer";
        g.onclick = () => onSelectRegion(regionName);
        g.onmouseenter = () => setHovered(regionName);
        g.onmouseleave = () => setHovered((prev) => (prev === regionName ? null : prev));
      } else {
        g.style.cursor = "default";
        g.onclick = null;
      }
    });
  }, [svgReady, valuesByRegion, min, max, onSelectRegion]);

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Explorer la carte du Japon
        </Button>
      </div>
    );
  }

  const hoveredRegion = hovered ? regions.find((r) => r.prefecture === hovered) : null;
  const hoveredValue = hovered ? (valuesByRegion.get(hovered) ?? null) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-border p-6 sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Carte du Japon
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Seules les 16 préfectures présentes dans notre base sont colorées ;
              le reste du Japon reste neutre (aucune donnée). Fukuoka Periph et
              Hyogo Rural sont affichées sur le contour de leur préfecture
              entière (Fukuoka, Hyōgo), qui ne correspond pas exactement à la
              sous-zone.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(MODE_LABELS) as MapMode[]).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "default" : "outline"}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </Button>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-[1fr_220px]">
          <div className="overflow-x-auto">
            <div ref={containerRef} className="mx-auto max-w-md [&_svg]:h-auto [&_svg]:w-full" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-3 w-3 rounded-sm" style={{ background: FROM_COLOR }} />
              <span>Plus bas</span>
              <span className="h-3 w-3 rounded-sm" style={{ background: TO_COLOR }} />
              <span>Plus haut</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-3 w-3 rounded-sm" style={{ background: NO_DATA_COLOR }} />
              <span>Aucune donnée</span>
            </div>

            {hoveredRegion ? (
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="mb-1 font-medium text-foreground">
                  {hoveredRegion.prefecture.replace(/_/g, " ")}
                </p>
                <p className="text-muted-foreground">
                  {mode === "prix" && hoveredValue !== null
                    ? `${formatJpy(hoveredValue)} (${formatEur(jpyToEur(hoveredValue))})`
                    : null}
                  {mode === "anciennete" && hoveredValue !== null ? `${hoveredValue}%` : null}
                  {mode === "aides" &&
                    (hoveredValue && hoveredValue > 0 ? formatJpy(hoveredValue) : "Aucune")}
                  {mode === "neige" &&
                    (hoveredValue !== null ? `${hoveredValue} cm/an` : "Donnée indisponible")}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Survolez ou cliquez une préfecture colorée pour voir sa valeur et la
                sélectionner.
              </p>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Fond de carte : Geolonia (geolonia/japanese-prefectures, GFDL), basé sur
          日本地図.svg de Wikipedia.
        </p>
      </Card>
    </motion.div>
  );
}
