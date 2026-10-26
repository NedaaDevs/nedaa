import {
  BRIGHTNESS,
  NEDAA_DARK,
  NEDAA_LIGHT,
  PLACE_HERO_PAINT,
  type Brightness,
} from "@/constants/Palette";
import { HERO_NOTE_INK } from "@/components/ui/place-hero";
import { PHASE, type Phase } from "@/constants/Phase";
import { BODY_BEHIND_TEXT, MOON_GLYPH, SUN_GLYPH } from "@/constants/Sky";
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

/** The least luminance step that keeps a card off its sky's own colour. */
const CARD_APART = 1.05;

const PALETTE = { [BRIGHTNESS.LIGHT]: NEDAA_LIGHT, [BRIGHTNESS.DARK]: NEDAA_DARK } as const;

/** Every phase, in both themes. */
const PHASES = Object.values(PHASE);
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

/** A colour at `alpha`, as an 8-digit hex. */
const withAlpha = (hex: string, alpha: number) =>
  `${hex.slice(0, 7)}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}`;

/** One colour laid over each sky stop. */
const flattenOverAll = (top: string, grounds: string[]) =>
  grounds.map((ground) => flattenOver(top, ground));

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

  // A card in the sky's own colour vanishes; its edge reads as a stray line.
  it("sets the quiet card apart from the sky", () => {
    const card = cardOver(palette.surfaceQuiet.hex, sky);

    sky.forEach((ground, i) => {
      expect(contrast(card[i], ground)).toBeGreaterThanOrEqual(CARD_APART);
    });
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

// The bowl's text sits under its crest and over its feet, where the body
// rides. The sun only lightens the light sky; the moon fades as behind text.
describe.each(CASES)("%s sky under the bowl's body", (_name, brightness, phase) => {
  const palette = PALETTE[brightness];
  const sky = skyStops(brightness, phase);
  const white = SUN_GLYPH.colour.hex;
  const bloom = Math.max(...SUN_GLYPH.bloomStops.map(([, alpha]) => alpha));
  const halo = MOON_GLYPH.halo.bright * BODY_BEHIND_TEXT.opacity;
  const lights = [
    ...(brightness === BRIGHTNESS.LIGHT
      ? ([
          ["the sun's core", flattenOverAll(withAlpha(white, 1), sky)],
          [
            "the sun's bloom",
            flattenOverAll(withAlpha(white, bloom * SUN_GLYPH.bloomStrength), sky),
          ],
        ] as const)
      : []),
    ["the moon's halo", flattenOverAll(withAlpha(MOON_GLYPH.halo.colour.hex, halo), sky)],
  ] as const;
  // From Maghrib to Isha the moon nears the Isha foot, whose name is then in
  // the accent; the muted Fajr name sits under it only after Isha.
  const inks = [
    palette.fg.hex,
    palette.accentText.hex,
    ...(phase === PHASE.MAGHRIB ? [] : [palette.mutedSky.hex]),
  ];

  it.each(lights)("keeps the bowl's text readable on %s", (_light, grounds) => {
    for (const ink of inks) {
      expect(worst(ink, [...grounds])).toBeGreaterThanOrEqual(AA);
    }
  });
});

// The copy may sit on any part of the gradient, bare or under the skyline.
describe.each(Object.entries(PLACE_HERO_PAINT))("the %s place hero", (_tone, byBrightness) => {
  it.each(Object.values(BRIGHTNESS))("keeps its title and note readable in %s", (brightness) => {
    const ink = PALETTE[brightness].fg.hex;
    const { stops, skyline } = byBrightness[brightness];
    const bare = stops.map(({ color }) => color.hex);
    const grounds = [...bare, ...flattenOverAll(skyline.hex, bare)];
    const note = withAlpha(ink, HERO_NOTE_INK[brightness]);

    expect(worst(ink, grounds)).toBeGreaterThanOrEqual(AA);
    grounds.forEach((ground) =>
      expect(contrast(flattenOver(note, ground), ground)).toBeGreaterThanOrEqual(AA)
    );
  });
});
