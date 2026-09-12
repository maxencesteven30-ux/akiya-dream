import { describe, expect, it } from "vitest";
import {
  errorResult,
  insufficientLocationResult,
  makeRealityDataResult,
  unavailableResult,
} from "@/lib/reality-data";

describe("makeRealityDataResult", () => {
  it("horodate automatiquement fetchedAt si non fourni", () => {
    const result = makeRealityDataResult("AVAILABLE", { sourceName: "Test" }, 42);
    expect(result.metadata.fetchedAt).toBeTruthy();
    expect(() => new Date(result.metadata.fetchedAt)).not.toThrow();
    expect(result.data).toBe(42);
  });

  it("conserve un fetchedAt fourni explicitement (ex. tests déterministes)", () => {
    const result = makeRealityDataResult("AVAILABLE", { sourceName: "Test", fetchedAt: "2026-01-01T00:00:00.000Z" });
    expect(result.metadata.fetchedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("unavailableResult", () => {
  it("retourne UNAVAILABLE, jamais NOT_FOUND (source non configurée ≠ aucune donnée)", () => {
    const result = unavailableResult("MLIT");
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.data).toBeUndefined();
  });
});

describe("insufficientLocationResult", () => {
  it("retourne INSUFFICIENT_LOCATION avec la précision géographique associée", () => {
    const result = insufficientLocationResult("MLIT Hazards");
    expect(result.status).toBe("INSUFFICIENT_LOCATION");
    expect(result.metadata.geographicPrecision).toBe("INSUFFICIENT");
  });
});

describe("errorResult", () => {
  it("retourne ERROR distinct de UNAVAILABLE et NOT_FOUND", () => {
    const result = errorResult("Frankfurter");
    expect(result.status).toBe("ERROR");
  });
});
