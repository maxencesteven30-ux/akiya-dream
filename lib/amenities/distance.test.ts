import { describe, expect, it } from "vitest";
import { haversineDistanceMeters } from "@/lib/amenities/distance";

describe("haversineDistanceMeters", () => {
  it("retourne 0 pour un point identique", () => {
    expect(haversineDistanceMeters(36.65, 138.18, 36.65, 138.18)).toBe(0);
  });

  it("distance connue Tokyo-Osaka (~400km, valeur de référence largement publiée)", () => {
    const distance = haversineDistanceMeters(35.6812, 139.7671, 34.6937, 135.5023);
    expect(distance / 1000).toBeGreaterThan(390);
    expect(distance / 1000).toBeLessThan(410);
  });

  it("une petite distance réelle (deux points à ~100m dans Nagano) reste dans une plage plausible", () => {
    const distance = haversineDistanceMeters(36.65, 138.18, 36.6509, 138.18);
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(110);
  });

  it("symétrique : distance(A,B) === distance(B,A)", () => {
    const ab = haversineDistanceMeters(36.65, 138.18, 36.66, 138.19);
    const ba = haversineDistanceMeters(36.66, 138.19, 36.65, 138.18);
    expect(ab).toBeCloseTo(ba, 6);
  });
});
