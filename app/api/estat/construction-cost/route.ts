import { fetchPrefectureConstructionCostPerSqm } from "@/lib/estat/construction-cost-provider";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const prefectureCode = url.searchParams.get("prefectureCode");

  if (!prefectureCode || !/^\d{2}$/.test(prefectureCode)) {
    return Response.json(
      { error: "Paramètre invalide : prefectureCode doit être un code préfecture à 2 chiffres." },
      { status: 400 },
    );
  }

  const result = await fetchPrefectureConstructionCostPerSqm(prefectureCode);
  return Response.json(result);
}
