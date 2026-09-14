import { describe, expect, it } from "vitest";
import { latLonToTile } from "@/lib/mlit/tile-math";

describe("latLonToTile", () => {
  it("convertit (36.65, 138.18) à z=14 en (x=14480, y=6397) — vérifié contre l'API XPT002 réelle le 2026-09-14", () => {
    expect(latLonToTile(36.65, 138.18, 14)).toEqual({ z: 14, x: 14480, y: 6397 });
  });

  it("reste cohérent à d'autres niveaux de zoom (la tuile parente contient la tuile enfant)", () => {
    const z14 = latLonToTile(36.65, 138.18, 14);
    const z13 = latLonToTile(36.65, 138.18, 13);
    expect(z13.x).toBe(Math.floor(z14.x / 2));
    expect(z13.y).toBe(Math.floor(z14.y / 2));
  });
});
