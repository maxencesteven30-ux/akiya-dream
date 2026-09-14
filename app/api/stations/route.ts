import { fetchNearestStations } from "@/lib/stations/provider";

// Era 9 (suite) — Route Handler dédié pour les gares (XKT015). Même
// discipline que /api/amenities : clé MLIT_API_KEY (serveur uniquement)
// jamais exposée.

function parseCoordinate(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = parseCoordinate(url.searchParams.get("latitude"));
  const longitude = parseCoordinate(url.searchParams.get("longitude"));

  const result = await fetchNearestStations({ latitude, longitude });
  return Response.json(result);
}
