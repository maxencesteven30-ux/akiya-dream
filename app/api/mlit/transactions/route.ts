import { fetchComparableTransactions } from "@/lib/mlit/provider";

// Phase AC — premier Route Handler du projet. Seul point d'entrée
// autorisé vers le provider MLIT : la clé MLIT_API_KEY (serveur
// uniquement) n'est jamais lue ni exposée ailleurs. Ne jamais loguer la
// clé ni l'inclure dans une réponse, y compris en cas d'erreur.

function parseQuarter(raw: string | null): 1 | 2 | 3 | 4 | null {
  const value = Number(raw);
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const municipalityCode = url.searchParams.get("municipalityCode");
  const year = Number(url.searchParams.get("year"));
  const quarter = parseQuarter(url.searchParams.get("quarter"));

  if (!Number.isInteger(year) || quarter === null) {
    return Response.json(
      { error: "Paramètres invalides : year (nombre entier) et quarter (1-4) sont requis." },
      { status: 400 },
    );
  }

  const result = await fetchComparableTransactions({ municipalityCode, year, quarter });
  return Response.json(result);
}
