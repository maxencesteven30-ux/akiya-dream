import { describe, expect, it } from "vitest";
import { interpolateColor, valueToColor } from "@/lib/map-colors";

describe("interpolateColor", () => {
  it("retourne la couleur de départ à ratio 0", () => {
    expect(interpolateColor("#000000", "#ffffff", 0)).toBe("#000000");
  });

  it("retourne la couleur d'arrivée à ratio 1", () => {
    expect(interpolateColor("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  it("retourne une couleur médiane à ratio 0.5", () => {
    expect(interpolateColor("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("borne le ratio entre 0 et 1", () => {
    expect(interpolateColor("#000000", "#ffffff", -1)).toBe("#000000");
    expect(interpolateColor("#000000", "#ffffff", 2)).toBe("#ffffff");
  });
});

describe("valueToColor", () => {
  it("retourne la couleur de départ pour la valeur minimale", () => {
    expect(valueToColor(0, 0, 100, "#000000", "#ffffff")).toBe("#000000");
  });

  it("retourne la couleur d'arrivée pour la valeur maximale", () => {
    expect(valueToColor(100, 0, 100, "#000000", "#ffffff")).toBe("#ffffff");
  });

  it("ne divise jamais par zéro quand min == max", () => {
    expect(valueToColor(50, 50, 50, "#000000", "#ffffff")).toBe("#000000");
  });
});
