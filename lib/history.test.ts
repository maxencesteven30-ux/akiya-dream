import { describe, expect, it } from "vitest";
import { computeHistoryDiffs, createHistoryEntry } from "@/lib/history";
import type { HistoryEntry } from "@/lib/types";

describe("createHistoryEntry", () => {
  it("capture les hypothèses fournies telles quelles", () => {
    const now = new Date("2026-09-11T10:00:00.000Z");
    const entry = createHistoryEntry(
      { housePriceJpy: 3_500_000, travauxJpy: 5_600_000, eurJpyRate: 179.27, opportunityScore: 8.2 },
      now,
    );
    expect(entry.housePriceJpy).toBe(3_500_000);
    expect(entry.travauxJpy).toBe(5_600_000);
    expect(entry.eurJpyRate).toBe(179.27);
    expect(entry.opportunityScore).toBe(8.2);
    expect(entry.timestamp).toBe(now.toISOString());
  });

  it("génère un identifiant unique à chaque appel", () => {
    const now = new Date("2026-09-11T10:00:00.000Z");
    const a = createHistoryEntry(
      { housePriceJpy: 1, travauxJpy: 1, eurJpyRate: 1, opportunityScore: null },
      now,
    );
    const b = createHistoryEntry(
      { housePriceJpy: 1, travauxJpy: 1, eurJpyRate: 1, opportunityScore: null },
      now,
    );
    expect(a.id).not.toBe(b.id);
  });

  it("accepte une note d'opportunité nulle (analyse pas encore lancée)", () => {
    const entry = createHistoryEntry({
      housePriceJpy: 1,
      travauxJpy: 1,
      eurJpyRate: 1,
      opportunityScore: null,
    });
    expect(entry.opportunityScore).toBeNull();
  });
});

describe("computeHistoryDiffs", () => {
  const base: HistoryEntry = {
    id: "1",
    timestamp: "2026-09-11T00:00:00.000Z",
    housePriceJpy: 3_500_000,
    travauxJpy: 5_600_000,
    eurJpyRate: 179.27,
    opportunityScore: 8.2,
  };

  it("ne calcule aucun delta pour le tout premier point d'étape", () => {
    const [first] = computeHistoryDiffs([base]);
    expect(first.previous).toBeNull();
    expect(first.priceDeltaJpy).toBeNull();
    expect(first.travauxDeltaJpy).toBeNull();
    expect(first.scoreDelta).toBeNull();
  });

  it("calcule les deltas par rapport au point d'étape précédent (pas au premier)", () => {
    const second: HistoryEntry = {
      ...base,
      id: "2",
      timestamp: "2026-09-12T00:00:00.000Z",
      travauxJpy: 7_200_000,
      opportunityScore: 7.4,
    };
    const third: HistoryEntry = {
      ...base,
      id: "3",
      timestamp: "2026-09-13T00:00:00.000Z",
      housePriceJpy: 3_200_000,
      travauxJpy: 7_200_000,
      opportunityScore: 7.9,
    };
    const diffs = computeHistoryDiffs([base, second, third]);

    expect(diffs[1].previous?.id).toBe("1");
    expect(diffs[1].priceDeltaJpy).toBe(0);
    expect(diffs[1].travauxDeltaJpy).toBe(1_600_000);
    expect(diffs[1].scoreDelta).toBeCloseTo(-0.8);

    expect(diffs[2].previous?.id).toBe("2");
    expect(diffs[2].priceDeltaJpy).toBe(-300_000);
    expect(diffs[2].travauxDeltaJpy).toBe(0);
    expect(diffs[2].scoreDelta).toBeCloseTo(0.5);
  });

  it("ne calcule pas de delta de note si l'une des deux notes est inconnue", () => {
    const withoutScore: HistoryEntry = { ...base, id: "2", opportunityScore: null };
    const diffs = computeHistoryDiffs([{ ...base, opportunityScore: null }, withoutScore]);
    expect(diffs[1].scoreDelta).toBeNull();
  });

  it("retourne un tableau vide pour un historique vide", () => {
    expect(computeHistoryDiffs([])).toEqual([]);
  });
});
