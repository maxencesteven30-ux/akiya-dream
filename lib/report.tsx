import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { BudgetBreakdown, BudgetScenario } from "@/lib/calculations";
import { jpyToEur } from "@/lib/data";
import { formatEur, formatJpy } from "@/lib/format";
import type { OpportunityResult } from "@/lib/opportunity";
import type { PropertyComparison } from "@/lib/comparison";
import type { Subsidy } from "@/lib/types";

export interface ReportData {
  propertyName: string;
  prefecture: string | null;
  budget: BudgetBreakdown;
  scenarios: BudgetScenario[];
  opportunity: OpportunityResult | null;
  subsidies: Subsidy[];
  comparison?: PropertyComparison[];
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#3D3935" },
  title: { fontSize: 18, marginBottom: 4, fontWeight: 700 },
  subtitle: { fontSize: 11, marginBottom: 16, color: "#6b6560" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e0d8",
  },
  rowLabel: { color: "#6b6560" },
  rowValue: { fontWeight: 700 },
  bigNumber: { fontSize: 24, fontWeight: 700, marginBottom: 2 },
  small: { fontSize: 9, color: "#6b6560" },
  badge: { fontSize: 9, marginTop: 2 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#9a948b" },
});

function MoneyRow({ label, jpy }: { label: string; jpy: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>
        {formatJpy(jpy)} (≈ {formatEur(jpyToEur(jpy))})
      </Text>
    </View>
  );
}

const DISCLAIMER =
  "Ce rapport est une estimation indicative générée par Akiya Dream à partir des données " +
  "renseignées. Il ne remplace pas une expertise immobilière, technique, juridique ou fiscale. " +
  "Vérifiez chaque élément avant toute décision.";

function ReportDocument({ data }: { data: ReportData }) {
  const { propertyName, prefecture, budget, scenarios, opportunity, subsidies, comparison } = data;
  const realiste = scenarios.find((s) => s.label === "realiste") ?? scenarios[0];

  return (
    <Document>
      {/* Page 1 — Résumé */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Akiya Dream — Rapport de projet</Text>
        <Text style={styles.subtitle}>
          {propertyName}
          {prefecture ? ` · ${prefecture.replace(/_/g, " ")}` : ""}
        </Text>

        <Text style={styles.sectionTitle}>Résumé</Text>
        <Text style={styles.bigNumber}>{formatJpy(budget.totalProjetJpy)}</Text>
        <Text style={styles.small}>soit {formatEur(budget.totalProjetEur)} — coût réel total</Text>

        {opportunity && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.bigNumber}>{opportunity.score.toFixed(1)} / 10</Text>
            <Text style={styles.small}>Note d&apos;opportunité (attractivité économique du projet)</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Prix d&apos;achat</Text>
        <MoneyRow label="Prix demandé" jpy={budget.prixAchatJpy} />
        <MoneyRow label="Frais d'acquisition" jpy={budget.acquisitionFees.total} />
        <MoneyRow label="Travaux" jpy={budget.travauxJpy} />

        <Text style={styles.footer}>{DISCLAIMER}</Text>
      </Page>

      {/* Page 2 — Détail du budget */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Détail du budget</Text>

        <Text style={styles.sectionTitle}>Frais d&apos;acquisition</Text>
        <MoneyRow label="Frais d'agence (Fudōsan)" jpy={budget.acquisitionFees.agence} />
        <MoneyRow label="Shihō shoshi (juriste)" jpy={budget.acquisitionFees.juriste} />
        <MoneyRow label="Taxes (acquisition + enregistrement)" jpy={budget.acquisitionFees.taxes} />
        {budget.acquisitionFees.montageJuridique > 0 && (
          <MoneyRow label="Montage juridique" jpy={budget.acquisitionFees.montageJuridique} />
        )}
        {budget.acquisitionFees.accompagnement > 0 && (
          <MoneyRow label="Accompagnement (agence spécialisée)" jpy={budget.acquisitionFees.accompagnement} />
        )}
        {budget.acquisitionFees.traduction > 0 && (
          <MoneyRow label="Traduction / interprétariat" jpy={budget.acquisitionFees.traduction} />
        )}

        <Text style={styles.sectionTitle}>Scénarios travaux</Text>
        {scenarios.map((scenario) => (
          <View key={scenario.label} style={styles.row}>
            <Text style={styles.rowLabel}>
              {scenario.label === "optimiste"
                ? "Optimiste"
                : scenario.label === "realiste"
                  ? "Réaliste"
                  : "Prudent"}
            </Text>
            <Text style={styles.rowValue}>
              {formatJpy(scenario.totalProjetJpy)} (≈ {formatEur(scenario.totalProjetEur)})
            </Text>
          </View>
        ))}
        <Text style={styles.small}>
          Le scénario réaliste ({formatJpy(realiste.totalProjetJpy)}) sert de référence
          principale — hypothèse de gestion explicite, pas une donnée mesurée.
        </Text>

        <Text style={styles.footer}>{DISCLAIMER}</Text>
      </Page>

      {/* Page 3 — Subventions éligibles */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Subventions éligibles</Text>
        {subsidies.length === 0 ? (
          <Text style={styles.small}>Aucune subvention sourcée identifiée pour ce projet.</Text>
        ) : (
          subsidies.map((subsidy) => (
            <View key={subsidy.id} style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{subsidy.name}</Text>
                <Text style={styles.rowValue}>
                  {formatJpy(subsidy.maxAmountJpy)} (≈ {formatEur(jpyToEur(subsidy.maxAmountJpy))})
                </Text>
              </View>
              <Text style={styles.small}>{subsidy.municipality}</Text>
              {subsidy.conditions.map((condition, i) => (
                <Text key={i} style={styles.badge}>
                  • {condition}
                </Text>
              ))}
            </View>
          ))
        )}
        <Text style={styles.small}>
          Demandez ces aides AVANT le début des travaux — la plupart des programmes ne sont pas
          rétroactifs. Vérifiez les conditions exactes auprès de la municipalité.
        </Text>

        <Text style={styles.footer}>{DISCLAIMER}</Text>
      </Page>

      {/* Page 4 (optionnelle) — Comparateur */}
      {comparison && comparison.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Comparateur de biens</Text>
          {comparison.map((c) => (
            <View key={c.propertyId} style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{c.name}</Text>
                <Text style={styles.rowValue}>
                  {formatJpy(c.totalBudgetJpy)} (≈ {formatEur(c.totalBudgetEur)})
                </Text>
              </View>
              <Text style={styles.small}>
                Note : {c.opportunityScore !== null ? `${c.opportunityScore.toFixed(1)} / 10` : "—"}
                {" · "}
                Verdict : {c.feasibilityVerdict ?? "—"}
                {" · "}
                Durée estimée : ~{c.renovationDurationMonths} mois
              </Text>
            </View>
          ))}
          <Text style={styles.footer}>{DISCLAIMER}</Text>
        </Page>
      )}
    </Document>
  );
}

export async function generateReportPDF(data: ReportData): Promise<Blob> {
  return pdf(<ReportDocument data={data} />).toBlob();
}
