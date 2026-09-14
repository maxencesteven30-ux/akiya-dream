import { fetchOfficialLandPrice } from "@/lib/mlit/land-price-provider";

// AD.2 — Route Handler dédié pour le prix foncier officiel (XPT002),
// distinct de /api/mlit/transactions. La clé MLIT_API_KEY (serveur
// uniquement) n'est jamais lue ni exposée ailleurs.

function parseCoordinate(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = parseCoordinate(url.searchParams.get("latitude"));
  const longitude = parseCoordinate(url.searchParams.get("longitude"));
  const year = Number(url.searchParams.get("year"));

  if (!Number.isInteger(year)) {
    return Response.json({ error: "Paramètre invalide : year (nombre entier) est requis." }, { status: 400 });
  }

  const result = await fetchOfficialLandPrice({ latitude, longitude, year });
  return Response.json(result);
}
