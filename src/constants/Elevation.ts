import { NEDAA_DARK, NEDAA_LIGHT, type Brightness } from "@/constants/Palette";

/** The shadow hue as r, g, b from the palette `shadow` hex; alpha is per layer. */
const hue = (hex: string): string =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

const HUE: Record<Brightness, string> = {
  light: hue(NEDAA_LIGHT.shadow.hex),
  dark: hue(NEDAA_DARK.shadow.hex),
};

type Layer = readonly [offsetY: number, blur: number, light: number, dark: number];

/** Two layers: a tight contact shadow and a wide ambient one. */
const layers = (brightness: Brightness, ...rows: Layer[]): string =>
  rows
    .map(([y, blur, light, dark]) => {
      const alpha = brightness === "light" ? light : dark;
      return `0 ${y}px ${blur}px rgba(${HUE[brightness]}, ${alpha})`;
    })
    .join(", ");

const both = (...rows: Layer[]) => ({
  light: layers("light", ...rows),
  dark: layers("dark", ...rows),
});

/**
 * Four levels of lift. `boxShadow` is for iOS and carries one string per theme;
 * `elevation` is the Android value. `null` draws nothing.
 */
export const ELEVATION = {
  e0: { boxShadow: { light: null, dark: null }, elevation: 0 },
  e1: { boxShadow: both([1, 2, 0.06, 0.3], [6, 16, 0.06, 0.28]), elevation: 2 },
  e2: { boxShadow: both([2, 4, 0.08, 0.35], [12, 32, 0.12, 0.45]), elevation: 8 },
  e3: { boxShadow: both([-8, 24, 0.1, 0.35], [-24, 64, 0.18, 0.55]), elevation: 16 },
} as const;

export type ElevationLevel = keyof typeof ELEVATION;

export const ELEVATION_LEVEL = {
  E0: "e0",
  E1: "e1",
  E2: "e2",
  E3: "e3",
} as const satisfies Record<string, ElevationLevel>;
