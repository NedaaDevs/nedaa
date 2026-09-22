/**
 * The colour palette, converted from the design prototype. Each token carries its
 * source oklch beside the hex, and `Palette.test.ts` re-derives one from the
 * other. Stylesheets read the hex; React Native cannot parse oklch.
 */

export type PaletteEntry = { readonly oklch: string; readonly hex: string };

/** From the prototype's phone-frame override, not its `:root`. */
export const NEDAA_LIGHT = {
  bg: { oklch: "oklch(93% 0.025 230)", hex: "#D8EBF6" },
  surface: { oklch: "oklch(97% 0.02 222 / .9)", hex: "#E7F9FFE6" },
  surface2: { oklch: "oklch(95% 0.032 225 / .72)", hex: "#D9F4FFB8" },
  fg: { oklch: "oklch(23% 0.055 254)", hex: "#081D36" },
  muted: { oklch: "oklch(45% 0.05 240)", hex: "#3B596E" },
  border: { oklch: "oklch(80% 0.045 230)", hex: "#A1C4D5" },
  accent: { oklch: "oklch(41.5% 0.09 232)", hex: "#005372" },
  accentSoft: { oklch: "oklch(93% 0.03 220)", hex: "#D3EDF6" },
  success: { oklch: "oklch(47% 0.105 155)", hex: "#196C40" },
  warn: { oklch: "oklch(57% 0.11 72)", hex: "#9F6B1E" },
  danger: { oklch: "oklch(50% 0.14 26)", hex: "#A43B36" },
  bar: { oklch: "oklch(96% 0.03 225 / .8)", hex: "#E1F6FFCC" },
} as const satisfies Record<string, PaletteEntry>;

/** `success` is ours: the prototype never declares it, and the light green reads 2.63:1 here. */
export const NEDAA_DARK = {
  bg: { oklch: "oklch(7% 0.015 252)", hex: "#000103" },
  surface: { oklch: "oklch(23% 0.065 258)", hex: "#071C3B" },
  surface2: { oklch: "oklch(26% 0.072 260)", hex: "#0D2346" },
  fg: { oklch: "oklch(93% 0.018 230)", hex: "#DCEAF2" },
  muted: { oklch: "oklch(72% 0.035 245)", hex: "#93A7BA" },
  border: { oklch: "oklch(37% 0.055 257)", hex: "#2D415D" },
  accent: { oklch: "oklch(80% 0.125 92)", hex: "#DBBB56" },
  accentSoft: { oklch: "oklch(33% 0.055 85)", hex: "#423310" },
  success: { oklch: "oklch(72% 0.11 175)", hex: "#4ABBA1" },
  warn: { oklch: "oklch(77% 0.11 80)", hex: "#D9AC5E" },
  danger: { oklch: "oklch(74% 0.12 28)", hex: "#ED8C80" },
  bar: { oklch: "oklch(19% 0.055 256 / .8)", hex: "#03132CCC" },
} as const satisfies Record<string, PaletteEntry>;

/** Derived, so a token added to one palette must be added to the other. */
export type ColorToken = keyof typeof NEDAA_LIGHT & keyof typeof NEDAA_DARK;

export const COLOR_TOKENS = Object.keys(NEDAA_LIGHT) as readonly ColorToken[];

export const PHASE = { DAWN: "dawn", ASR: "asr", MAGHRIB: "maghrib" } as const;
export type Phase = (typeof PHASE)[keyof typeof PHASE];

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
export const PHASE_GRADIENTS: Record<Phase, Record<Brightness, PhaseGradient | null>> = {
  [PHASE.ASR]: {
    light: {
      angle: 140,
      from: "surface2",
      base: "surface2",
      tint: "#EAD095",
      percent: 22,
      to: "#DFEAE2C8",
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
      to: "#E1DFE7EB",
    },
    dark: {
      angle: 150,
      from: "surface",
      base: "surface",
      tint: "#BB7588",
      percent: 18,
      to: "#282C49",
    },
  },
  [PHASE.DAWN]: {
    light: {
      angle: 160,
      from: "surface2",
      base: "surface",
      tint: "#BFAFCF",
      percent: 18,
      to: "#DFEAF6EB",
    },
    dark: null,
  },
};
