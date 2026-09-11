// Dégradé linéaire déterministe entre deux couleurs de la charte
// Japandi, basé sur la position de la valeur dans l'étendue min-max
// observée. Pas une échelle officielle : une interpolation simple et
// documentée, cohérente avec le reste de l'application (ex. rural/neige
// dans lib/scoring.ts).

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function interpolateColor(from: string, to: string, ratio: number): string {
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  return rgbToHex(
    r1 + (r2 - r1) * clampedRatio,
    g1 + (g2 - g1) * clampedRatio,
    b1 + (b2 - b1) * clampedRatio,
  );
}

export function valueToColor(
  value: number,
  min: number,
  max: number,
  fromColor: string,
  toColor: string,
): string {
  if (max === min) return fromColor;
  const ratio = (value - min) / (max - min);
  return interpolateColor(fromColor, toColor, ratio);
}

export const NO_DATA_COLOR = "#E5E0DA";
