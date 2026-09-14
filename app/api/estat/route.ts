import { fetchMunicipalityIndicator } from "@/lib/estat/provider";
import type { EstatIndicator } from "@/lib/estat-contract";

// Era 9 (suite) — Route Handler dédié pour e-Stat. Même discipline que
// /api/hazard et /api/demographics : ESTAT_APP_ID (serveur uniquement)
// n'est jamais lue ni exposée ici.

const VALID_INDICATORS: EstatIndicator[] = ["population", "population_change_rate", "households"];

function isEstatIndicator(value: string | null): value is EstatIndicator {
  return value !== null && (VALID_INDICATORS as string[]).includes(value);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const municipalityCode = url.searchParams.get("municipalityCode");
  const indicator = url.searchParams.get("indicator");

  if (!isEstatIndicator(indicator)) {
    return Response.json(
      { error: `Paramètre invalide : indicator doit être l'un de ${VALID_INDICATORS.join(", ")}.` },
      { status: 400 },
    );
  }

  const result = await fetchMunicipalityIndicator(municipalityCode, indicator);
  return Response.json(result);
}
