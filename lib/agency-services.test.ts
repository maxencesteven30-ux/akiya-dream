import { describe, expect, it } from "vitest";
import {
  getAgencyService,
  getAgencyServiceMidpoint,
  getAllAgencyServices,
} from "@/lib/agency-services";

describe("getAllAgencyServices", () => {
  it("retourne les 5 services attendus", () => {
    const all = getAllAgencyServices();
    expect(all.length).toBe(5);
    expect(all.map((s) => s.serviceId)).toEqual(
      expect.arrayContaining([
        "AGENCY_LEGAL",
        "AGENCY_CURATION",
        "AGENCY_TURNKEY",
        "LEGAL_SCLEM",
        "TRANSLATION_SRV",
      ]),
    );
  });
});

describe("getAgencyService", () => {
  it("retourne le service demandé", () => {
    const service = getAgencyService("AGENCY_TURNKEY");
    expect(service.priceMinJpy).toBe(500000);
    expect(service.priceMaxJpy).toBe(1000000);
  });

  it("lève une erreur explicite pour un identifiant inconnu (jamais de valeur inventée)", () => {
    expect(() => getAgencyService("UNKNOWN_ID")).toThrow();
  });
});

describe("getAgencyServiceMidpoint", () => {
  it("calcule le milieu exact de la fourchette", () => {
    expect(getAgencyServiceMidpoint("AGENCY_CURATION")).toBe(250000);
    expect(getAgencyServiceMidpoint("AGENCY_TURNKEY")).toBe(750000);
    expect(getAgencyServiceMidpoint("TRANSLATION_SRV")).toBe(125000);
  });
});
