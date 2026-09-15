// Géocodage du CENTRE APPROXIMATIF d'une commune (jamais l'adresse d'un
// bien précis) via l'API de recherche d'adresse du GSI (国土地理院 —
// Geospatial Information Authority of Japan, service public, gratuit,
// sans clé). Vérifié par appel réel le 2026-09-15 :
// https://msearch.gsi.go.jp/address-search/AddressSearch?q=鹿児島県鹿児島市
// -> un unique résultat {coordinates:[130.557022,31.596861],
// addressCode:"", title:"鹿児島県鹿児島市"} — un point proche à quelques
// dizaines de mètres de 鹿児島市役所 (mairie), confirmé en comparant aux
// résultats détaillés (dataSource:"3") retournés pour une recherche plus
// large sur "鹿児島市" seul.
//
// Usage strictement documenté : ce point sert d'ancrage pour interroger
// les moteurs MLIT (risques, services, gares) à l'échelle d'une commune
// quand aucune adresse précise n'est encore connue — jamais présenté
// comme l'emplacement d'un bien réel. Toute UI qui consomme ce point
// DOIT afficher explicitement qu'il s'agit d'une approximation
// centre-ville, pas d'une adresse.

const GSI_ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch";
const REQUEST_TIMEOUT_MS = 8_000;

export interface MunicipalityCenterPoint {
  latitude: number;
  longitude: number;
}

interface GsiFeature {
  geometry: { coordinates: [number, number]; type: string };
  properties: { title: string; addressCode: string; dataSource?: string };
}

function isGsiFeatureArray(value: unknown): value is GsiFeature[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "geometry" in entry &&
        "properties" in entry,
    )
  );
}

function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}

// Le premier résultat retourné pour "<préfecture><commune>" est
// systématiquement l'entrée sans dataSource (le repère "commune entière"
// du GSI, pas un établissement particulier) — vérifié réellement pour
// 鹿児島県鹿児島市 (grande ville) et 鹿児島県三島村 (petite commune isolée),
// les deux cas donnant un unique résultat exploitable.
export async function fetchMunicipalityCenterPoint(
  prefectureNameJa: string,
  municipalityNameJa: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MunicipalityCenterPoint | null> {
  if (!isServerEnvironment()) return null;

  const url = new URL(GSI_ENDPOINT);
  url.searchParams.set("q", `${prefectureNameJa}${municipalityNameJa}`);

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), { signal: timeoutController.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) return null;

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return null;
  }

  if (!isGsiFeatureArray(json) || json.length === 0) return null;

  const wholeMunicipalityMatch = json.find((f) => !f.properties.dataSource) ?? json[0];
  const [longitude, latitude] = wholeMunicipalityMatch.geometry.coordinates;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;

  return { latitude, longitude };
}
