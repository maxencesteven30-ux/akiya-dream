"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/simulateur/money";
import { generateReportPDF, type ReportData } from "@/lib/report";

interface ExportSectionProps {
  reportData: Omit<ReportData, "comparison">;
  comparisonAvailable: boolean;
  comparisonData: ReportData["comparison"];
}

export function ExportSection({
  reportData,
  comparisonAvailable,
  comparisonData,
}: ExportSectionProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [includeComparateur, setIncludeComparateur] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setDownloading(true);
    setError(null);
    try {
      const blob = await generateReportPDF({
        ...reportData,
        comparison: includeComparateur ? comparisonData : undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `akiya-dream-${reportData.propertyName.toLowerCase().replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Génération du PDF impossible:", err);
      setError("Impossible de générer le rapport PDF. Réessayez.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        📥 Export
      </h2>
      <p className="mb-5 text-lg text-foreground">Emportez votre analyse</p>

      <Card className="border-border p-6 sm:p-8">
        {comparisonAvailable && (
          <Label className="mb-4 flex cursor-pointer items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={includeComparateur}
              onCheckedChange={(checked) => setIncludeComparateur(checked)}
            />
            Inclure le comparateur de biens
          </Label>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleExport} disabled={downloading}>
            {downloading ? "Génération..." : "📄 Exporter le rapport PDF"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? "Masquer l'aperçu" : "Voir l'aperçu"}
          </Button>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        {showPreview && (
          <div className="mt-5 space-y-4 rounded-md border border-border p-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Page 1 — Résumé
              </p>
              <p className="font-medium text-foreground">
                {reportData.propertyName}
                {reportData.prefecture ? ` · ${reportData.prefecture.replace(/_/g, " ")}` : ""}
              </p>
              <Money jpy={reportData.budget.totalProjetJpy} className="text-foreground" />
              {reportData.opportunity && (
                <p className="text-foreground">{reportData.opportunity.score.toFixed(1)} / 10</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Page 2 — Détail du budget
              </p>
              <p className="text-muted-foreground">
                Frais d&apos;acquisition, accompagnement, scénarios travaux (optimiste/réaliste/
                prudent).
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Page 3 — Subventions éligibles
              </p>
              <p className="text-muted-foreground">
                {reportData.subsidies.length} programme{reportData.subsidies.length > 1 ? "s" : ""}{" "}
                listé{reportData.subsidies.length > 1 ? "s" : ""}.
              </p>
            </div>
            {includeComparateur && comparisonAvailable && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Page 4 — Comparateur
                </p>
                <p className="text-muted-foreground">
                  {comparisonData?.length ?? 0} bien{(comparisonData?.length ?? 0) > 1 ? "s" : ""}{" "}
                  comparé{(comparisonData?.length ?? 0) > 1 ? "s" : ""}.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>
    </motion.section>
  );
}
