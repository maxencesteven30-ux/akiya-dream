import { fetchMunicipalities } from "@/lib/mlit/municipalities-provider";

// Route Handler pour XIT002 (liste des communes d'une préfecture). Même
// discipline que les autres routes MLIT : MLIT_API_KEY n'est jamais lue
// ni exposée ici, uniquement côté provider serveur.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const prefectureCode = url.searchParams.get("prefectureCode");

  if (!prefectureCode || !/^\d{2}$/.test(prefectureCode)) {
    return Response.json(
      { error: "Paramètre invalide : prefectureCode doit être un code préfecture à 2 chiffres." },
      { status: 400 },
    );
  }

  const result = await fetchMunicipalities(prefectureCode);
  return Response.json(result);
}
