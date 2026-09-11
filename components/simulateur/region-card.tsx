"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { jpyToEur } from "@/lib/data";
import { formatEur, formatJpy } from "@/lib/format";
import type { DataConfidence, Region, RegionAttributeDetail } from "@/lib/types";

interface RegionCardProps {
  region: Region;
  attributeDetails: RegionAttributeDetail[] | undefined;
}

const CONFIDENCE_DOT: Record<DataConfidence, string> = {
  verified: "#16a34a",
  estimated: "#d97706",
  unknown: "#9ca3af",
};

const CONFIDENCE_LABEL: Record<DataConfidence, string> = {
  verified: "Vérifiée",
  estimated: "Estimée",
  unknown: "Inconnue",
};

function formatAttributeValue(detail: RegionAttributeDetail): string {
  if (detail.value === null) return "Donnée indisponible";
  if (detail.key === "has_coastline") return detail.value === 1 ? "Oui" : "Non";
  return `${detail.value}${detail.unit ? " " + detail.unit : ""}`;
}

export function RegionCard({ region, attributeDetails }: RegionCardProps) {
  return (
    <Card className="border-border p-6 sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-lg font-medium text-foreground">
          {region.prefecture.replace(/_/g, " ")}
        </p>
        <Badge variant="secondary">Niveau {region.recommendationLevel}</Badge>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Prix médian</p>
          <p className="text-foreground">
            {formatJpy(region.medianPriceJpy)}{" "}
            <span className="text-xs text-muted-foreground">
              (≈ {formatEur(jpyToEur(region.medianPriceJpy))})
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Subvention maximale documentée</p>
          <p className="text-foreground">
            {region.subsidyMaxJpy > 0 ? (
              <>
                {formatJpy(region.subsidyMaxJpy)}{" "}
                <span className="text-xs text-muted-foreground">
                  (≈ {formatEur(jpyToEur(region.subsidyMaxJpy))})
                </span>
              </>
            ) : (
              "Aucune"
            )}
          </p>
        </div>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">
        Prix médian, âge médian et niveau : données initiales du projet, sans source ni
        date de vérification documentées individuellement — à traiter avec plus de
        prudence que les attributs ci-dessous.
      </p>

      <Separator className="mb-4" />

      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Attributs régionaux — source et fiabilité
      </p>

      {!attributeDetails || attributeDetails.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun attribut collecté pour cette région.</p>
      ) : (
        <ul className="space-y-3">
          {attributeDetails.map((detail) => (
            <li key={detail.key} className="rounded-md border border-border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{detail.label}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: CONFIDENCE_DOT[detail.confidence] }}
                    aria-hidden="true"
                  />
                  {CONFIDENCE_LABEL[detail.confidence]}
                </span>
              </div>
              <p className="text-foreground">{formatAttributeValue(detail)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {detail.sourceUrl ? (
                  <a
                    href={detail.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {detail.sourceName}
                  </a>
                ) : (
                  detail.sourceName
                )}
                {" — vérifié le "}
                {detail.verifiedAt}
              </p>
              {detail.notes && (
                <p className="mt-1 text-xs text-muted-foreground">{detail.notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
