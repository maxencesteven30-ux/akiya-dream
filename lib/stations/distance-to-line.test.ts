import { describe, expect, it } from "vitest";
import { distanceToLineStringMeters } from "@/lib/stations/distance-to-line";

describe("distanceToLineStringMeters", () => {
  it("distance ~0 pour un point sur le segment", () => {
    const line: [number, number][] = [
      [138.18, 36.65],
      [138.19, 36.66],
    ];
    // point à mi-segment (interpolation linéaire simple)
    const distance = distanceToLineStringMeters(36.655, 138.185, line);
    expect(distance).toBeLessThan(50);
  });

  it("distance à une extrémité pour un point aligné avec le début du segment", () => {
    const line: [number, number][] = [
      [138.18, 36.65],
      [138.19, 36.66],
    ];
    const distance = distanceToLineStringMeters(36.65, 138.18, line);
    expect(distance).toBeLessThan(5);
  });

  it("un point éloigné retourne une grande distance, jamais 0 par erreur", () => {
    const line: [number, number][] = [
      [138.18, 36.65],
      [138.19, 36.66],
    ];
    const distance = distanceToLineStringMeters(37.0, 139.0, line);
    expect(distance).toBeGreaterThan(50_000);
  });

  it("gère une LineString à plusieurs segments (minimum sur chaque tronçon)", () => {
    const line: [number, number][] = [
      [138.18, 36.65],
      [138.19, 36.66],
      [138.2, 36.65],
    ];
    const distance = distanceToLineStringMeters(36.65, 138.2, line);
    expect(distance).toBeLessThan(50);
  });

  it("Infinity pour une LineString dégénérée (moins de deux points), jamais 0 par défaut", () => {
    expect(distanceToLineStringMeters(36.65, 138.18, [])).toBe(Infinity);
    expect(distanceToLineStringMeters(36.65, 138.18, [[138.18, 36.65]])).toBe(Infinity);
  });
});
