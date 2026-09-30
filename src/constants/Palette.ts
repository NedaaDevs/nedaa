/**
 * The colour palette, converted from the design prototype. Each token carries its
 * source oklch beside the hex, and `Palette.test.ts` re-derives one from the
 * other. Stylesheets read the hex; React Native cannot parse oklch.
 */

import { PHASE } from "@/constants/Phase";

export type PaletteEntry = { readonly oklch: string; readonly hex: string };

/** From the prototype's phone-frame override, not its `:root`. */
export const NEDAA_LIGHT = {
  bg: { oklch: "oklch(93% 0.025 230)", hex: "#D8EBF6" },
  surface: { oklch: "oklch(97% 0.02 222 / .9)", hex: "#E7F9FFE6" },
  surface2: { oklch: "oklch(95% 0.032 225 / .72)", hex: "#D9F4FFB8" },
  /** `surface2` at .6, for a row or field lifted inside a sheet. */
  surface2Soft: { oklch: "oklch(95% 0.032 225 / .6)", hex: "#D9F4FF99" },
  /** `surface2` thinned for a panel nested inside a sheet. */
  panel: { oklch: "oklch(95% 0.032 225 / .42)", hex: "#D9F4FF6B" },
  /** A surface lifted over any sky, e.g. a toast; nearly opaque. */
  raised: { oklch: "oklch(97% 0.02 222 / .98)", hex: "#E7F9FFFA" },
  shadow: { oklch: "oklch(20% 0.04 250 / .24)", hex: "#0717273D" },
  fg: { oklch: "oklch(23% 0.055 254)", hex: "#081D36" },
  muted: { oklch: "oklch(45% 0.05 240)", hex: "#3B596E" },
  /** Muted text on the deeper day sky, where `muted` falls to 3:1. */
  mutedSky: { oklch: "oklch(35% 0.05 240)", hex: "#203E52" },
  border: { oklch: "oklch(80% 0.045 230)", hex: "#A1C4D5" },
  accent: { oklch: "oklch(41.5% 0.09 232)", hex: "#005372" },
  accentSoft: { oklch: "oklch(93% 0.03 220)", hex: "#D3EDF6" },
  /** Outline of a chosen pill: the accent at half strength. */
  accentEdge: { oklch: "oklch(41.5% 0.09 232 / .52)", hex: "#00537285" },
  /** A faint accent ring, e.g. round a hero icon. */
  accentLine: { oklch: "oklch(41.5% 0.09 232 / .32)", hex: "#00537252" },
  /** The app dimmed behind a sheet: a navy on the ink's hue. */
  scrim: { oklch: "oklch(20% 0.03 254 / .42)", hex: "#0C17236B" },
  success: { oklch: "oklch(47% 0.105 155)", hex: "#196C40" },
  warn: { oklch: "oklch(57% 0.11 72)", hex: "#9F6B1E" },
  danger: { oklch: "oklch(50% 0.14 26)", hex: "#A43B36" },
  bar: { oklch: "oklch(96% 0.03 225 / .8)", hex: "#E1F6FFCC" },
  // Switch track while off, sheet handle, switch thumb: tints of the ink.
  track: { oklch: "oklch(23% 0.055 254 / .18)", hex: "#081D362E" },
  handle: { oklch: "oklch(23% 0.055 254 / .28)", hex: "#081D3647" },
  thumb: { oklch: "oklch(99% 0 0)", hex: "#FCFCFC" },
  /** A pressed row's wash: a faint tint of the ink. */
  pressed: { oklch: "oklch(23% 0.055 254 / .05)", hex: "#081D360D" },
  /** The tinted square behind a row's accent glyph. */
  tile: { oklch: "oklch(91% 0.042 223)", hex: "#C4E8F6" },
} as const satisfies Record<string, PaletteEntry>;

/** `success` is ours: the prototype never declares it, and the light green reads 2.63:1 here. */
export const NEDAA_DARK = {
  bg: { oklch: "oklch(7% 0.015 252)", hex: "#000103" },
  surface: { oklch: "oklch(23% 0.065 258)", hex: "#071C3B" },
  surface2: { oklch: "oklch(26% 0.072 260)", hex: "#0D2346" },
  surface2Soft: { oklch: "oklch(26% 0.072 260 / .6)", hex: "#0D234699" },
  panel: { oklch: "oklch(26% 0.072 260 / .42)", hex: "#0D23466B" },
  raised: { oklch: "oklch(23% 0.065 258 / .98)", hex: "#071C3BFA" },
  shadow: { oklch: "oklch(5% 0.03 260 / .5)", hex: "#00000280" },
  fg: { oklch: "oklch(93% 0.018 230)", hex: "#DCEAF2" },
  muted: { oklch: "oklch(72% 0.035 245)", hex: "#93A7BA" },
  mutedSky: { oklch: "oklch(72% 0.035 245)", hex: "#93A7BA" },
  border: { oklch: "oklch(37% 0.055 257)", hex: "#2D415D" },
  accent: { oklch: "oklch(80% 0.125 92)", hex: "#DBBB56" },
  accentSoft: { oklch: "oklch(33% 0.055 85)", hex: "#423310" },
  accentEdge: { oklch: "oklch(80% 0.125 92 / .52)", hex: "#DBBB5685" },
  accentLine: { oklch: "oklch(80% 0.125 92 / .32)", hex: "#DBBB5652" },
  scrim: { oklch: "oklch(20% 0.03 230 / .42)", hex: "#0618216B" },
  success: { oklch: "oklch(72% 0.11 175)", hex: "#4ABBA1" },
  warn: { oklch: "oklch(77% 0.11 80)", hex: "#D9AC5E" },
  danger: { oklch: "oklch(74% 0.12 28)", hex: "#ED8C80" },
  bar: { oklch: "oklch(19% 0.055 256 / .8)", hex: "#03132CCC" },
  track: { oklch: "oklch(93% 0.018 230 / .18)", hex: "#DCEAF22E" },
  handle: { oklch: "oklch(93% 0.018 230 / .28)", hex: "#DCEAF247" },
  thumb: { oklch: "oklch(99% 0 0)", hex: "#FCFCFC" },
  pressed: { oklch: "oklch(93% 0.018 230 / .05)", hex: "#DCEAF20D" },
  tile: { oklch: "oklch(33% 0.058 258)", hex: "#223653" },
} as const satisfies Record<string, PaletteEntry>;

/** Derived, so a token added to one palette must be added to the other. */
export type ColorToken = keyof typeof NEDAA_LIGHT & keyof typeof NEDAA_DARK;

export const COLOR_TOKENS = Object.keys(NEDAA_LIGHT) as readonly ColorToken[];

/** The phases whose sky carries a tint; day and night keep the plain surface. */
type TintedPhase = typeof PHASE.DAWN | typeof PHASE.ASR | typeof PHASE.MAGHRIB;

export const BRIGHTNESS = { LIGHT: "light", DARK: "dark" } as const;
export type Brightness = (typeof BRIGHTNESS)[keyof typeof BRIGHTNESS];

type PhaseGradient = {
  angle: number;
  /** Palette token the gradient starts from. */
  from: ColorToken;
  /** The tint mixed into `base`; `to` is the result, re-derived by the test. */
  base: ColorToken;
  tint: string;
  percent: number;
  to: string;
};

/** `null` where the design tints nothing and the surface shows plain. */
export const PHASE_GRADIENTS: Record<TintedPhase, Record<Brightness, PhaseGradient | null>> = {
  [PHASE.ASR]: {
    light: {
      angle: 140,
      from: "surface2",
      base: "surface2",
      tint: "#EAD095",
      percent: 22,
      to: "#C5F1F0C8",
    },
    dark: null,
  },
  [PHASE.MAGHRIB]: {
    light: {
      angle: 150,
      from: "surface",
      base: "surface",
      tint: "#BB7588",
      percent: 18,
      to: "#CEE3F6EB",
    },
    dark: {
      angle: 150,
      from: "surface",
      base: "surface",
      tint: "#BB7588",
      percent: 18,
      to: "#262A52",
    },
  },
  [PHASE.DAWN]: {
    light: {
      angle: 160,
      from: "surface2",
      base: "surface",
      tint: "#BFAFCF",
      percent: 18,
      to: "#D9ECF8EB",
    },
    dark: null,
  },
};
