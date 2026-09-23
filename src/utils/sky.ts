import {
  BRIGHTNESS,
  NEDAA_DARK,
  NEDAA_LIGHT,
  PHASE_GRADIENTS,
  type Brightness,
} from "@/constants/Palette";
import type { Phase } from "@/constants/Phase";
import { DARK_SKY, LIGHT_SKY, type SkyDisc, type SkyEllipse, type SkyStop } from "@/constants/Sky";

export type SceneStop = { offset: number; color: string };
export type SceneLinear = { angle: number; stops: SceneStop[] };

/** Everything the sky paints, back to front; `null` where a layer is absent. */
export type SkyScene = {
  /** Equal keys paint the same sky, so only a new key crossfades. */
  key: string;
  underlay: string;
  base: SceneLinear;
  glow: SkyEllipse | null;
  horizon: SkyEllipse | null;
  sun: typeof LIGHT_SKY.sun | null;
  moon: typeof DARK_SKY | null;
  edgeWash: SceneStop[] | null;
};

const PALETTE = { [BRIGHTNESS.LIGHT]: NEDAA_LIGHT, [BRIGHTNESS.DARK]: NEDAA_DARK } as const;

const isTinted = (phase: Phase): phase is keyof typeof PHASE_GRADIENTS => phase in PHASE_GRADIENTS;

const PLAIN_KEY = "plain";

const hexStops = (stops: readonly SkyStop[]): SceneStop[] =>
  stops.map(({ offset, color }) => ({ offset, color: color.hex }));

const tintFor = (brightness: Brightness, phase: Phase | undefined) => {
  if (!phase || !isTinted(phase)) return null;
  return PHASE_GRADIENTS[phase][brightness];
};

export const skyScene = (brightness: Brightness, phase: Phase | undefined): SkyScene => {
  const palette = PALETTE[brightness];
  const tint = tintFor(brightness, phase);
  const light = brightness === BRIGHTNESS.LIGHT;

  const plainBase: SceneLinear = light
    ? { angle: 180, stops: hexStops(LIGHT_SKY.base) }
    : {
        angle: 180,
        stops: [
          { offset: 0, color: palette.surface.hex },
          { offset: 1, color: palette.surface.hex },
        ],
      };

  return {
    key: `${brightness}:${tint && phase ? phase : PLAIN_KEY}`,
    underlay: palette.bg.hex,
    base: tint
      ? {
          angle: tint.angle,
          stops: [
            { offset: 0, color: palette[tint.from].hex },
            { offset: 1, color: tint.to },
          ],
        }
      : plainBase,
    glow: light && !tint ? LIGHT_SKY.glow : null,
    horizon: light ? LIGHT_SKY.horizon : null,
    sun: light ? LIGHT_SKY.sun : null,
    moon: light ? null : DARK_SKY,
    edgeWash: light ? hexStops(LIGHT_SKY.edgeWash) : null,
  };
};

/** A blurred disc: solid to `solidUntil` of `radius`, then clear. */
export const fadedDisc = (diameter: number, fade: number) => {
  const radius = diameter / 2 + fade;
  return { radius, solidUntil: (diameter / 2 - fade) / radius };
};

const pct = (fraction: number) => `${Number((fraction * 100).toFixed(2))}%`;

const stopList = (stops: readonly SceneStop[]) =>
  stops.map(({ offset, color }) => `${color} ${pct(offset)}`).join(", ");

/** The colour at zero alpha, so a fade never passes through another hue. */
const clear = (hex: string) => `${hex.slice(0, 7)}00`;

// Two equal radii: RN's parser drops the token after a lone size.
const circleAt = (radius: number, cx: number, cy: number, stops: string) =>
  `radial-gradient(${radius}px ${radius}px at ${cx}px ${cy}px, ${stops})`;

/** The centre of a disc pinned past the top-right corner. */
const centreOf = ({ diameter, top, right }: SkyDisc, width: number) => ({
  cx: width - right - diameter / 2,
  cy: top + diameter / 2,
});

const blurredDisc = (cx: number, cy: number, diameter: number, fade: number, hex: string) => {
  const { radius, solidUntil } = fadedDisc(diameter, fade);
  return circleAt(radius, cx, cy, `${hex} 0%, ${hex} ${pct(solidUntil)}, ${clear(hex)} 100%`);
};

/** The scene as one CSS gradient list, front layer first, sized to the box. */
export const skyBackgroundImage = (
  scene: SkyScene,
  width: number,
  height: number,
  isRTL: boolean
): string => {
  const { base, glow, horizon, sun, moon, edgeWash } = scene;
  const layers: string[] = [];

  if (edgeWash) layers.push(`linear-gradient(${isRTL ? 270 : 90}deg, ${stopList(edgeWash)})`);
  if (moon) {
    const { cx, cy } = centreOf(moon.moon.disc, width);
    const { moon: disc, moonHalo: halo, edgeFade } = moon;
    layers.push(blurredDisc(cx, cy, disc.disc.diameter, edgeFade, disc.color.hex));
    layers.push(
      blurredDisc(
        cx + halo.dx,
        cy + halo.dy,
        disc.disc.diameter + 2 * halo.spread,
        edgeFade,
        halo.color.hex
      )
    );
  }
  if (sun) {
    const { cx, cy } = centreOf(sun.disc, width);
    // CSS sizes a bare `circle` gradient to its box's farthest corner.
    const radius = (sun.disc.diameter / 2) * Math.SQRT2;
    const faded = sun.stops.map(({ offset, color }) => ({
      offset,
      color: withOpacity(color.hex, sun.opacity),
    }));
    layers.push(circleAt(radius, cx, cy, stopList(faded)));
  }
  for (const ellipse of [horizon, glow]) {
    if (!ellipse) continue;
    const { cx, cy, rx, ry, stops } = ellipse;
    layers.push(
      `radial-gradient(${rx * width}px ${ry * height}px at ${cx * width}px ${cy * height}px, ${stopList(hexStops(stops))})`
    );
  }
  layers.push(`linear-gradient(${base.angle}deg, ${stopList(base.stops)})`);

  return layers.join(", ");
};

/** Scales a colour's alpha, for a layer the design fades as a whole. */
const withOpacity = (hex: string, opacity: number) => {
  const alpha = hex.length === 9 ? parseInt(hex.slice(7), 16) : 255;
  return `${hex.slice(0, 7)}${Math.round(alpha * opacity)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}`;
};
