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

const E2_CONTACT: Layer = [2, 4, 0.08, 0.35];

/**
 * Four levels of lift, one `boxShadow` string per theme; `null` draws nothing.
 * Both platforms draw it: Android `elevation` shows through a see-through fill.
 */
export const ELEVATION = {
  e0: { boxShadow: { light: null, dark: null } },
  e1: { boxShadow: both([1, 2, 0.06, 0.3], [6, 16, 0.06, 0.28]) },
  e2: { boxShadow: both(E2_CONTACT, [12, 32, 0.12, 0.45]) },
  e3: { boxShadow: both([-8, 24, 0.1, 0.35], [-24, 64, 0.18, 0.55]) },
} as const;

export type ElevationLevel = keyof typeof ELEVATION;

/** e2's tight layer alone, for a part lifted inside a track. */
export const CONTACT_SHADOW = both(E2_CONTACT);

export const ELEVATION_LEVEL = {
  E0: "e0",
  E1: "e1",
  E2: "e2",
  E3: "e3",
} as const satisfies Record<string, ElevationLevel>;
