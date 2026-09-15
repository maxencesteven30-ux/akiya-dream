import { describe, expect, it } from "vitest";
import {
  compareListingsForDuplicate,
  findPossibleDuplicates,
  type DuplicatePairResult,
} from "@/lib/discovery/duplicate-detection";
import { createEmptyPropertyListing } from "@/lib/discovery/property-listing";
import type { PropertyListing } from "@/lib/discovery/property-listing";

function makeListing(id: string, source: string, overrides: Partial<PropertyListing> = {}): PropertyListing {
  return { ...createEmptyPropertyListing(id, source, `${id}-src`), ...overrides };
}

describe("compareListingsForDuplicate", () => {
  it("NOT_ENOUGH_SIGNAL quand rien n'est comparable (aucun champ commun connu)", () => {
    const a = makeListing("a", "source-a");
    const b = makeListing("b", "source-b");
    expect(compareListingsForDuplicate(a, b).verdict).toBe("NOT_ENOUGH_SIGNAL");
  });

  it("DIFFERENT_MUNICIPALITY quand les codes municipaux connus diffèrent -- disqualifiant immédiat", () => {
    const a = makeListing("a", "source-a", { municipalityCode: "32501", priceJpy: 3_000_000 });
    const b = makeListing("b", "source-b", { municipalityCode: "20201", priceJpy: 3_000_000 });
    expect(compareListingsForDuplicate(a, b).verdict).toBe("DIFFERENT_MUNICIPALITY");
  });

  it("POSSIBLE_DUPLICATE sur des coordonnées proches seules (signal fort)", () => {
    const a = makeListing("a", "source-a", { latitude: 34.4500, longitude: 131.7600 });
    const b = makeListing("b", "source-b", { latitude: 34.4501, longitude: 131.7601 });
    const result = compareListingsForDuplicate(a, b);
    expect(result.verdict).toBe("POSSIBLE_DUPLICATE");
    expect(result.matchedSignals).toContain("close_coordinates");
  });

  it("NOT_ENOUGH_SIGNAL si les coordonnées sont éloignées, même très proches en apparence", () => {
    const a = makeListing("a", "source-a", { latitude: 34.4500, longitude: 131.7600 });
    const b = makeListing("b", "source-b", { latitude: 34.5000, longitude: 131.8000 }); // ~6km
    expect(compareListingsForDuplicate(a, b).verdict).toBe("NOT_ENOUGH_SIGNAL");
  });

  it("POSSIBLE_DUPLICATE sur une adresse identique (normalisée), signal fort seul", () => {
    const a = makeListing("a", "source-a", { address: "島根県津和野町後田 123" });
    const b = makeListing("b", "source-b", { address: "  島根県津和野町後田123 " });
    const result = compareListingsForDuplicate(a, b);
    expect(result.verdict).toBe("POSSIBLE_DUPLICATE");
    expect(result.matchedSignals).toContain("same_address");
  });

  it("NOT_ENOUGH_SIGNAL avec un seul signal faible (ex. même prix seul)", () => {
    const a = makeListing("a", "source-a", { priceJpy: 3_000_000 });
    const b = makeListing("b", "source-b", { priceJpy: 3_000_000 });
    expect(compareListingsForDuplicate(a, b).verdict).toBe("NOT_ENOUGH_SIGNAL");
  });

  it("POSSIBLE_DUPLICATE quand 3 signaux faibles concordent, sans aucun signal fort", () => {
    const a = makeListing("a", "source-a", { priceJpy: 3_000_000, buildingAreaM2: 90, buildingYear: 1985 });
    const b = makeListing("b", "source-b", { priceJpy: 3_000_000, buildingAreaM2: 91, buildingYear: 1985 });
    const result = compareListingsForDuplicate(a, b);
    expect(result.verdict).toBe("POSSIBLE_DUPLICATE");
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["same_price", "similar_surface", "same_building_year"]),
    );
  });

  it("une surface qui diffère de plus de 5% n'est jamais comptée comme similaire", () => {
    const a = makeListing("a", "source-a", { priceJpy: 3_000_000, buildingAreaM2: 90, buildingYear: 1985 });
    const b = makeListing("b", "source-b", { priceJpy: 3_000_000, buildingAreaM2: 120, buildingYear: 1985 });
    const result = compareListingsForDuplicate(a, b);
    expect(result.matchedSignals).not.toContain("similar_surface");
    expect(result.verdict).toBe("NOT_ENOUGH_SIGNAL"); // seulement 2 signaux faibles
  });
});

describe("findPossibleDuplicates", () => {
  it("ne compare jamais deux annonces de la MÊME source -- déjà géré par l'upsert", () => {
    const a = makeListing("a", "source-a", { latitude: 34.45, longitude: 131.76 });
    const b = makeListing("b", "source-a", { latitude: 34.4501, longitude: 131.7601 });
    expect(findPossibleDuplicates([a, b])).toHaveLength(0);
  });

  it("détecte une paire suspecte entre deux sources différentes", () => {
    const a = makeListing("a", "source-a", { latitude: 34.45, longitude: 131.76 });
    const b = makeListing("b", "source-b", { latitude: 34.4501, longitude: 131.7601 });
    const results = findPossibleDuplicates([a, b]);
    expect(results).toHaveLength(1);
    expect(results[0].verdict).toBe("POSSIBLE_DUPLICATE");
  });

  it("ne remonte jamais une paire DIFFERENT_MUNICIPALITY ou NOT_ENOUGH_SIGNAL", () => {
    const a = makeListing("a", "source-a", { municipalityCode: "32501" });
    const b = makeListing("b", "source-b", { municipalityCode: "20201" });
    const c = makeListing("c", "source-c");
    const results: DuplicatePairResult[] = findPossibleDuplicates([a, b, c]);
    expect(results).toHaveLength(0);
  });

  it("retourne un tableau vide pour un pool vide ou à un seul élément", () => {
    expect(findPossibleDuplicates([])).toHaveLength(0);
    expect(findPossibleDuplicates([makeListing("a", "source-a")])).toHaveLength(0);
  });
});
