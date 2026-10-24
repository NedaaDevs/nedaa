import { BRIGHTNESS, NEDAA_DARK, NEDAA_LIGHT, type Brightness } from "@/constants/Palette";
import { PHASE, type Phase } from "@/constants/Phase";
import { flattenOver, skyScene } from "@/utils/sky";

/** Relative luminance, then the WCAG ratio. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** WCAG AA for text below 18pt: every level-3 line is 13–14pt. */
const AA = 4.5;

const PALETTE = { [BRIGHTNESS.LIGHT]: NEDAA_LIGHT, [BRIGHTNESS.DARK]: NEDAA_DARK } as const;

/** The five phases the design checks, in both themes. */
const PHASES = [PHASE.DAWN, PHASE.DAY, PHASE.ASR, PHASE.MAGHRIB, PHASE.NIGHT] as const;
const CASES = Object.values(BRIGHTNESS).flatMap((brightness) =>
  PHASES.map((phase) => [`${brightness} ${phase}`, brightness, phase] as const)
);

/** Each stop of the phase's base gradient, laid over its underlay. */
const skyStops = (brightness: Brightness, phase: Phase) => {
  const scene = skyScene(brightness, phase);
  return scene.base.stops.map(({ color }) => flattenOver(color, scene.underlay));
};

/** The least contrast `ink` reaches on any of `grounds`. */
const worst = (ink: string, grounds: string[]) =>
  Math.min(...grounds.map((ground) => contrast(ink, ground)));

/** A translucent card laid over each sky stop. */
const cardOver = (card: string, grounds: string[]) =>
  grounds.map((ground) => flattenOver(card, ground));

describe.each(CASES)("%s sky", (_name, brightness, phase) => {
  const palette = PALETTE[brightness];
  const sky = skyStops(brightness, phase);

  // Brand, Gregorian date, city line, sunrise cell and other times.
  it("keeps level-3 text readable", () => {
    expect(worst(palette.mutedSky.hex, sky)).toBeGreaterThanOrEqual(AA);
  });

  it.each([
    ["the glass card", "surfaceGlass"],
    ["the quiet card", "surfaceQuiet"],
  ] as const)("keeps text readable on %s", (_card, surface) => {
    const card = cardOver(palette[surface].hex, sky);

    expect(worst(palette.fg.hex, card)).toBeGreaterThanOrEqual(AA);
    expect(worst(palette.mutedSky.hex, card)).toBeGreaterThanOrEqual(AA);
  });

  // The next-prayer label, back links, text buttons and tinted pills.
  it("keeps accent text readable on the sky", () => {
    expect(worst(palette.accentText.hex, sky)).toBeGreaterThanOrEqual(AA);
  });

  it.each([
    ["the glass card", "surfaceGlass"],
    ["the quiet card", "surfaceQuiet"],
    ["the float material", "surfaceFloat"],
    ["the raised sheet", "raised"],
    ["the accent tint", "accentTint"],
  ] as const)("keeps accent text readable on %s", (_part, surface) => {
    expect(
      worst(palette.accentText.hex, cardOver(palette[surface].hex, sky))
    ).toBeGreaterThanOrEqual(AA);
  });

  it("keeps accent text readable on the accent's soft fill", () => {
    expect(contrast(palette.accentText.hex, palette.accentSoft.hex)).toBeGreaterThanOrEqual(AA);
  });
});
