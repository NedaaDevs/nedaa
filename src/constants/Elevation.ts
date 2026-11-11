import { BRIGHTNESS, NEDAA_DARK, NEDAA_LIGHT, type Brightness } from "@/constants/Palette";

/** The shadow hue as r, g, b from the palette `shadow` hex; alpha is per layer. */
const hue = (hex: string): string =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

const HUE: Record<Brightness, string> = {
  [BRIGHTNESS.LIGHT]: hue(NEDAA_LIGHT.shadow.hex),
  [BRIGHTNESS.DARK]: hue(NEDAA_DARK.shadow.hex),
};

type Layer = readonly [offsetY: number, blur: number, light: number, dark: number];

/** Two layers: a tight contact shadow and a wide ambient one. */
const layers = (brightness: Brightness, ...rows: Layer[]): string =>
  rows
    .map(([y, blur, light, dark]) => {
      const alpha = brightness === BRIGHTNESS.LIGHT ? light : dark;
      return `0 ${y}px ${blur}px rgba(${HUE[brightness]}, ${alpha})`;
    })
    .join(", ");

const both = (...rows: Layer[]) => ({
  [BRIGHTNESS.LIGHT]: layers(BRIGHTNESS.LIGHT, ...rows),
  [BRIGHTNESS.DARK]: layers(BRIGHTNESS.DARK, ...rows),
});

const E2_CONTACT: Layer = [2, 4, 0.08, 0.35];

export const ELEVATION_LEVEL = {
  E0: "e0",
  E1: "e1",
  E2: "e2",
  E3: "e3",
} as const;

export type ElevationLevel = (typeof ELEVATION_LEVEL)[keyof typeof ELEVATION_LEVEL];

/**
 * Four levels of lift, one `boxShadow` string per theme; `null` draws nothing.
 * Both platforms draw it: Android `elevation` shows through a see-through fill.
 */
export const ELEVATION = {
  [ELEVATION_LEVEL.E0]: { boxShadow: { [BRIGHTNESS.LIGHT]: null, [BRIGHTNESS.DARK]: null } },
  [ELEVATION_LEVEL.E1]: { boxShadow: both([1, 2, 0.06, 0.3], [6, 16, 0.06, 0.28]) },
  [ELEVATION_LEVEL.E2]: { boxShadow: both(E2_CONTACT, [12, 32, 0.12, 0.45]) },
  [ELEVATION_LEVEL.E3]: { boxShadow: both([-8, 24, 0.1, 0.35], [-24, 64, 0.18, 0.55]) },
} as const satisfies Record<ElevationLevel, { boxShadow: Record<Brightness, string | null> }>;

/** e2's tight layer alone, for a part lifted inside a track. */
export const CONTACT_SHADOW = both(E2_CONTACT);

/** The accent glow under the next prayer's card: offset and blur, in points. */
const ACCENT_GLOW = { offsetY: 10, blur: 24 } as const;

/** A soft accent-coloured lift; the colour is the theme's `accentGlow`. */
export const accentGlowShadow = (color: string): string =>
  `0 ${ACCENT_GLOW.offsetY}px ${ACCENT_GLOW.blur}px ${color}`;
