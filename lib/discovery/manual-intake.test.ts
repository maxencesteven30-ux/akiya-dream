import { describe, expect, it } from "vitest";
import {
  buildPropertyListingFromManualIntake,
  createEmptyManualIntakeInput,
} from "@/lib/discovery/manual-intake";

function baseInput() {
  return {
    ...createEmptyManualIntakeInput(),
    source: "tomi-city-akiyabank",
    sourceListingId: "322",
  };
}

describe("createEmptyManualIntakeInput", () => {
  it("tout champ non-identité démarre à null, jamais une valeur devinée", () => {
    const input = createEmptyManualIntakeInput();
    expect(input.priceRaw).toBeNull();
    expect(input.hasGarden).toBeNull();
    expect(input.availabilityStatus).toBe("UNKNOWN");
  });
});

describe("buildPropertyListingFromManualIntake", () => {
  it("applique les parseurs de vocabulaire japonais aux champs bruts fournis", () => {
    const input = {
      ...baseInput(),
      priceRaw: "300万円",
      landAreaRaw: "250.5㎡",
      buildingAreaRaw: "90m²",
      floorPlanRaw: "3LDK",
      buildingYearRaw: "1985年建築",
      stationDistanceRaw: "徒歩20分",
      rebuildabilityRaw: "再建築可の土地です",
      sewageRaw: "浄化槽設置済み",
    };

    const listing = buildPropertyListingFromManualIntake("1", input, "2026-09-15T00:00:00.000Z");

    expect(listing.priceJpy).toBe(3_000_000);
    expect(listing.landAreaM2).toBe(250.5);
    expect(listing.buildingAreaM2).toBe(90);
    expect(listing.roomCount).toBe(3);
    expect(listing.buildingYear).toBe(1985);
    expect(listing.buildingEra).toBe("POST_1981");
    expect(listing.stationDistance).toEqual({ value: 20, unit: "minutes_walk" });
    expect(listing.rebuildability).toBe("verifie");
    expect(listing.sewage).toBe("verifie");
  });

  it("un champ brut non reconnu par son parseur reste null, jamais deviné", () => {
    const input = {
      ...baseInput(),
      priceRaw: "prix sur demande",
      floorPlanRaw: "grand terrain",
      rebuildabilityRaw: "belle vue sur la montagne",
    };

    const listing = buildPropertyListingFromManualIntake("1", input);

    expect(listing.priceJpy).toBeNull();
    expect(listing.roomCount).toBeNull();
    expect(listing.rebuildability).toBeNull();
  });

  it("un champ brut absent (null) n'est jamais envoyé au parseur, reste null", () => {
    const listing = buildPropertyListingFromManualIntake("1", baseInput());

    expect(listing.priceJpy).toBeNull();
    expect(listing.landAreaM2).toBeNull();
    expect(listing.buildingYear).toBeNull();
    expect(listing.buildingEra).toBeNull();
    expect(listing.stationDistance).toBeNull();
  });

  it("hasGarden/hasParking sont pris tels quels, jamais déduits d'un texte", () => {
    const input = { ...baseInput(), hasGarden: true, hasParking: false };
    const listing = buildPropertyListingFromManualIntake("1", input);

    expect(listing.hasGarden).toBe(true);
    expect(listing.hasParking).toBe(false);
  });

  it("conserve la saisie brute complète dans rawData pour audit", () => {
    const input = { ...baseInput(), priceRaw: "300万円" };
    const listing = buildPropertyListingFromManualIntake("1", input);

    expect(listing.rawData).toEqual(input);
  });

  it("conserve identité/source/statut de disponibilité choisi", () => {
    const input = { ...baseInput(), availabilityStatus: "ACTIVE" as const };
    const listing = buildPropertyListingFromManualIntake("42", input, "2026-09-15T00:00:00.000Z");

    expect(listing.id).toBe("42");
    expect(listing.source).toBe("tomi-city-akiyabank");
    expect(listing.sourceListingId).toBe("322");
    expect(listing.availabilityStatus).toBe("ACTIVE");
    expect(listing.retrievedAt).toBe("2026-09-15T00:00:00.000Z");
  });
});
