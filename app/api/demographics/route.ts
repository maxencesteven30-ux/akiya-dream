import { fetchPopulationProjection } from "@/lib/demographics/provider";

// Era 9 (suite) — Route Handler dédié pour la démographie (XKT013).
// Même discipline que /api/mlit/land-price et /api/hazard :
// MLIT_API_KEY (serveur uniquement) n'est jamais lue ni exposée ici.

function parseCoordinate(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = parseCoordinate(url.searchParams.get("latitude"));
  const longitude = parseCoordinate(url.searchParams.get("longitude"));

  const result = await fetchPopulationProjection({ latitude, longitude });
  return Response.json(result);
}
