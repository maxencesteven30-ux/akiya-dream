import { describe, expect, it } from "vitest";
import { pointInMultiPolygon, pointInPolygon, type PolygonCoordinates } from "@/lib/hazard/point-in-polygon";

// Carré simple : lon 0..10, lat 0..10.
const SQUARE: PolygonCoordinates = [
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ],
];

describe("pointInPolygon", () => {
  it("un point clairement à l'intérieur est détecté", () => {
    expect(pointInPolygon(5, 5, SQUARE)).toBe(true);
  });

  it("un point clairement à l'extérieur n'est pas détecté", () => {
    expect(pointInPolygon(50, 50, SQUARE)).toBe(false);
  });

  it("un point dans un trou (anneau intérieur) n'est pas détecté", () => {
    const withHole: PolygonCoordinates = [
      SQUARE[0],
      [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
        [4, 4],
      ],
    ];
    expect(pointInPolygon(5, 5, withHole)).toBe(false);
    // toujours à l'intérieur du contour hors du trou
    expect(pointInPolygon(1, 1, withHole)).toBe(true);
  });

  it("un polygone vide ne contient jamais aucun point", () => {
    expect(pointInPolygon(5, 5, [])).toBe(false);
  });

  it("les coordonnées réelles MLIT (lon~138, lat~36) fonctionnent à cette échelle", () => {
    const tokyoArea: PolygonCoordinates = [
      [
        [138.17, 36.636],
        [138.173, 36.636],
        [138.173, 36.64],
        [138.17, 36.64],
        [138.17, 36.636],
      ],
    ];
    expect(pointInPolygon(138.1715, 36.638, tokyoArea)).toBe(true);
    expect(pointInPolygon(139.0, 36.638, tokyoArea)).toBe(false);
  });
});

describe("pointInMultiPolygon", () => {
  it("détecte un point dans n'importe lequel des polygones", () => {
    const other: PolygonCoordinates = [
      [
        [100, 100],
        [110, 100],
        [110, 110],
        [100, 110],
        [100, 100],
      ],
    ];
    expect(pointInMultiPolygon(5, 5, [SQUARE, other])).toBe(true);
    expect(pointInMultiPolygon(105, 105, [SQUARE, other])).toBe(true);
    expect(pointInMultiPolygon(500, 500, [SQUARE, other])).toBe(false);
  });

  it("une liste vide ne contient jamais aucun point", () => {
    expect(pointInMultiPolygon(5, 5, [])).toBe(false);
  });
});
