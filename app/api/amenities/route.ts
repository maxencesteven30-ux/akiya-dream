import { fetchNearestAmenities, type AmenityCategory } from "@/lib/amenities/provider";

// Era 9 (suite) — Route Handler dédié pour les services essentiels
// (XKT006/010/011/017/018). Même discipline que /api/hazard : clé
// MLIT_API_KEY (serveur uniquement) jamais exposée.

const VALID_CATEGORIES: AmenityCategory[] = ["school", "medical", "welfare", "cultural", "town_hall"];

function isAmenityCategory(value: string | null): value is AmenityCategory {
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

  if (!isAmenityCategory(category)) {
    return Response.json(
      { error: `Paramètre invalide : category doit être l'un de ${VALID_CATEGORIES.join(", ")}.` },
      { status: 400 },
    );
  }

  const result = await fetchNearestAmenities({ category, latitude, longitude });
  return Response.json(result);
}
