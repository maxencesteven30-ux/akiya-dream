// Era 9 / Phase AG — Source Registry.
//
// Registre central des sources de listings. Recherche réelle effectuée
// le 2026-09-15 (WebSearch/WebFetch) avant toute entrée — aucune source
// ni condition d'accès n'est supposée. Résultat honnête : à ce jour,
// AUCUNE source ne dispose d'une API ou d'un flux public en libre-service
// (cf. section 8 de la mission — ne jamais présumer qu'un site autorise
// l'extraction automatisée simplement parce qu'il est accessible).
//
// - Le répertoire de liens du MLIT n'est qu'une liste de liens vers des
//   sites municipaux indépendants, sans donnée structurée
//   (vérifié par WebFetch : "全国の地方公共団体等の空き家・空き地情報
//   掲載サイトのリンク集です", aucune condition de réutilisation publiée).
// - LIFULL HOME'S et At Home opèrent l'agrégateur national sous mandat
//   MLIT (dispositif lancé en 2018), mais aucune API publique en
//   libre-service n'a été identifiée — une intégration de données existe
//   pour certains partenaires, via une démarche commerciale directe,
//   pas un accès self-service programmatique.
// - La participation municipale à l'agrégateur national est volontaire :
//   une annonce peut exister sur un site municipal sans jamais y
//   apparaître.
//
// Une source indisponible ne doit jamais faire planter le moteur : toute
// fonction de ce module reste défensive (filter/find, jamais de throw).

export type SourceType = "municipal_akiya_bank" | "national_aggregator" | "private_portal" | "government_data";
export type SourceAccessMethod = "api" | "feed" | "link_directory" | "manual";
export type SourceReliability = "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";

export type SourceStatus = "ACTIVE" | "LIMITED" | "UNAVAILABLE" | "REQUIRES_AUTHORIZATION" | "MANUAL_ONLY";

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  ACTIVE: "🟢 Active",
  LIMITED: "🟠 Limitée",
  UNAVAILABLE: "🔴 Indisponible",
  REQUIRES_AUTHORIZATION: "🟠 Autorisation requise",
  MANUAL_ONLY: "⚪ Manuel uniquement",
};

export interface SourceRegistryEntry {
  id: string;
  name: string;
  type: SourceType;
  country: string;
  official: boolean;
  accessMethod: SourceAccessMethod;
  // Description honnête des conditions de réutilisation constatées —
  // jamais "oui" par défaut faute de vérification.
  permittedReuse: string;
  refreshStrategy: "manual" | "scheduled" | "on_demand" | "none";
  reliability: SourceReliability;
  lastChecked: string;
  status: SourceStatus;
  sourceUrl: string;
  notes: string;
}

// Recherche effectuée le 2026-09-15 — à revérifier périodiquement
// (lastChecked), jamais considérée figée définitivement.
export const SOURCE_REGISTRY: SourceRegistryEntry[] = [
  {
    id: "mlit-akiyabank-link-directory",
    name: "MLIT — répertoire des banques d'akiya municipales",
    type: "government_data",
    country: "JP",
    official: true,
    accessMethod: "link_directory",
    permittedReuse:
      "Répertoire de liens externes uniquement, aucune donnée structurée, aucune condition de réutilisation publiée.",
    refreshStrategy: "manual",
    reliability: "UNVERIFIED",
    lastChecked: "2026-09-15",
    status: "MANUAL_ONLY",
    sourceUrl: "https://www.mlit.go.jp/totikensangyo/const/akiyabank_link.html",
    notes: "Vérifié par WebFetch : une liste de liens, pas une API ni un flux.",
  },
  {
    id: "lifull-homes-akiyabank",
    name: "LIFULL HOME'S 空き家バンク (agrégateur national)",
    type: "national_aggregator",
    country: "JP",
    official: false,
    accessMethod: "manual",
    permittedReuse:
      "Aucune API publique en libre-service identifiée — intégration de données existante pour certains partenaires via démarche commerciale directe, pas un accès self-service.",
    refreshStrategy: "none",
    reliability: "UNVERIFIED",
    lastChecked: "2026-09-15",
    status: "REQUIRES_AUTHORIZATION",
    sourceUrl: "https://www.homes.co.jp/akiya-baank/",
    notes: "Participation municipale volontaire — une annonce peut n'exister que localement.",
  },
  {
    id: "athome-akiyabank",
    name: "At Home 空き家バンク (agrégateur national)",
    type: "national_aggregator",
    country: "JP",
    official: false,
    accessMethod: "manual",
    permittedReuse: "Même situation que LIFULL HOME'S — aucune API publique identifiée.",
    refreshStrategy: "none",
    reliability: "UNVERIFIED",
    lastChecked: "2026-09-15",
    status: "REQUIRES_AUTHORIZATION",
    sourceUrl: "https://www.akiya-athome.jp/",
    notes: "Co-opérateur historique du dispositif MLIT depuis 2018, mêmes conditions que LIFULL.",
  },
];

export function getSourceById(id: string): SourceRegistryEntry | null {
  return SOURCE_REGISTRY.find((entry) => entry.id === id) ?? null;
}

export function getSourcesByStatus(status: SourceStatus): SourceRegistryEntry[] {
  return SOURCE_REGISTRY.filter((entry) => entry.status === status);
}

// Le cœur de la garantie AG : une source n'est éligible à une ingestion
// automatisée que si son accès est réellement programmatique (api/feed)
// ET que son statut l'autorise (ACTIVE/LIMITED). Aujourd'hui : liste
// vide, honnêtement — aucune source ne remplit ces deux conditions.
// Jamais une source "manual"/"link_directory" ou REQUIRES_AUTHORIZATION
// ne doit être retournée ici, quel que soit son statut par ailleurs.
export function getSourcesEligibleForAutomatedIngestion(): SourceRegistryEntry[] {
  return SOURCE_REGISTRY.filter(
    (entry) =>
      (entry.accessMethod === "api" || entry.accessMethod === "feed") &&
      (entry.status === "ACTIVE" || entry.status === "LIMITED"),
  );
}
