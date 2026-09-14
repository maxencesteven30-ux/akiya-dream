import { fetchHazardZone, type PolygonHazardCategory } from "@/lib/hazard/provider";

// Era 9 (suite) — Route Handler dédié pour le moteur de risques
// (XKT026/027/028/029). Même discipline que /api/mlit/land-price :
// MLIT_API_KEY (serveur uniquement) n'est jamais lue ni exposée ici.

const VALID_CATEGORIES: PolygonHazardCategory[] = ["flood", "landslide", "tsunami", "storm_surge"];

function isPolygonHazardCategory(value: string | null): value is PolygonHazardCategory {
  return value !== null && (VALID_CATEGORIES as string[]).includes(value);
}

function parseCoordinate(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const latitude = parseCoordinate(url.searchParams.get("latitude"));
  const longitude = parseCoordinate(url.searchParams.get("longitude"));

  if (!isPolygonHazardCategory(category)) {
    return Response.json(
      { error: `Paramètre invalide : category doit être l'un de ${VALID_CATEGORIES.join(", ")}.` },
      { status: 400 },
    );
  }

  const result = await fetchHazardZone({ category, latitude, longitude });
  return Response.json(result);
}
