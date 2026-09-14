import { describe, expect, it } from "vitest";
import { computeMarketContext } from "@/lib/market-context";
import type { MlitTransaction } from "@/lib/mlit/types";
import type { ComparableSubject } from "@/lib/comparable-transactions";

function transaction(overrides: Partial<MlitTransaction> = {}): MlitTransaction {
  return {
    municipalityCode: "20201",
    prefecture: "長野県",
    municipality: "長野市",
    districtName: "Test",
    tradePriceJpy: 5_000_000,
    areaM2: 200,
    totalFloorAreaM2: 90,
    buildingYear: 2000,
    structure: null,
    use: "住宅",
    landShape: null,
    cityPlanning: null,
    period: "2024年第1四半期",
    districtCode: "TEST",
    ...overrides,
  };
}

const SUBJECT: ComparableSubject = { municipalityCode: "20201", surfaceM2: 90, constructionYear: 2000 };

describe("computeMarketContext", () => {
  it("favorable quand le prix demandé est inférieur aux comparables", () => {
    const context = computeMarketContext(3_000_000, "AVAILABLE", SUBJECT, [
      transaction({ districtCode: "A" }),
      transaction({ districtCode: "B" }),
      transaction({ districtCode: "C" }),
    ]);
    expect(context.level).toBe("favorable");
  });

  it("defavorable quand le prix demandé dépasse les comparables", () => {
    const context = computeMarketContext(9_000_000, "AVAILABLE", SUBJECT, [
      transaction({ districtCode: "A" }),
      transaction({ districtCode: "B" }),
      transaction({ districtCode: "C" }),
    ]);
    expect(context.level).toBe("defavorable");
  });

  it("indisponible quand le fournisseur MLIT est UNAVAILABLE (clé absente)", () => {
    const context = computeMarketContext(5_000_000, "UNAVAILABLE", SUBJECT, []);
    expect(context.level).toBe("indisponible");
  });

  it("indisponible quand aucun comparable n'est trouvé, jamais interprété comme neutre/favorable", () => {
    const context = computeMarketContext(5_000_000, "AVAILABLE", SUBJECT, []);
    expect(context.level).toBe("indisponible");
  });

  it("neutre quand le prix est dans la fourchette", () => {
    const context = computeMarketContext(5_000_000, "AVAILABLE", SUBJECT, [
      transaction({ districtCode: "A", tradePriceJpy: 4_000_000 }),
      transaction({ districtCode: "B", tradePriceJpy: 6_000_000 }),
      transaction({ districtCode: "C", tradePriceJpy: 5_000_000 }),
    ]);
    expect(context.level).toBe("neutre");
  });
});
