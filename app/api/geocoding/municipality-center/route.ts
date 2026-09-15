import { fetchMunicipalityCenterPoint } from "@/lib/geocoding/gsi-provider";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const prefectureNameJa = url.searchParams.get("prefectureNameJa");
  const municipalityNameJa = url.searchParams.get("municipalityNameJa");

  if (!prefectureNameJa || !municipalityNameJa) {
    return Response.json(
      { error: "Paramètres invalides : prefectureNameJa et municipalityNameJa sont requis." },
      { status: 400 },
    );
  }

  const point = await fetchMunicipalityCenterPoint(prefectureNameJa, municipalityNameJa);
  return Response.json({ point });
}
