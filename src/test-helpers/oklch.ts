/**
 * OKLCH to sRGB hex. React Native parses hex, rgb, hsl and hwb only, so no
 * oklch() reaches a stylesheet. Outside `__tests__` because jest collects every
 * file there as a suite.
 */

export type Oklch = { l: number; c: number; h: number; alpha: number };

const OKLCH = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

export const parseOklch = (input: string): Oklch => {
  const m = input.trim().match(OKLCH);
  if (!m) throw new Error(`Not an oklch() colour: ${input}`);
  const raw = m[4];
  return {
    l: Number(m[1]) / 100,
    c: Number(m[2]),
    h: Number(m[3]),
    alpha: raw === undefined ? 1 : raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw),
  };
};

/** Linear-light sRGB, outside 0–1 when the colour is out of gamut. */
const toLinearSrgb = ({ l, c, h }: Pick<Oklch, "l" | "c" | "h">): [number, number, number] => {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3) as [number, number, number];

  return [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ];
};

// Tolerance, so 1.0000000002 is not called out of gamut.
const EPSILON = 1e-6;
const inGamut = (rgb: number[]) => rgb.every((v) => v >= -EPSILON && v <= 1 + EPSILON);

/** Reduces chroma until the colour fits sRGB, holding lightness and hue. */
const gamutMap = (colour: Pick<Oklch, "l" | "c" | "h">): [number, number, number] => {
  const direct = toLinearSrgb(colour);
  if (inGamut(direct)) return direct;

  let low = 0;
  let high = colour.c;
  let best = toLinearSrgb({ ...colour, c: 0 });
  // 24 halvings resolve finer than one 8-bit step.
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    const candidate = toLinearSrgb({ ...colour, c: mid });
    if (inGamut(candidate)) {
      best = candidate;
      low = mid;
    } else {
      high = mid;
    }
  }
  return best;
};

const encodeGamma = (v: number) => {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
};

const toByte = (v: number) =>
  Math.round(v * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

/** 8-digit hex when the colour carries alpha. */
export const oklchToHex = (input: string): string => {
  const { alpha, ...colour } = parseOklch(input);
  const rgb = gamutMap(colour).map(encodeGamma).map(toByte).join("");
  return alpha >= 1 ? `#${rgb}` : `#${rgb}${toByte(alpha)}`;
};

type Oklab = { L: number; a: number; b: number; alpha: number };

const decodeGamma = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

const hexToOklab = (hex: string): Oklab => {
  const at = (i: number) => decodeGamma(parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = [at(1), at(3), at(5)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    alpha: hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1,
  };
};

/** Shortest arc between two hue angles, in degrees. */
const hueDelta = (from: number, to: number): number => {
  const raw = (to - from) % 360;
  return raw > 180 ? raw - 360 : raw < -180 ? raw + 360 : raw;
};

/**
 * `color-mix(in oklch, base, tint P%)`. Polar: lightness and chroma interpolate,
 * hue takes the shortest arc. Rectangular OKLab instead cuts near the grey axis,
 * so two colours far apart in hue mix to a duller third one.
 *
 * Alpha premultiplies L and C but not the hue angle, per CSS Color 4.
 */
export const mixOklch = (baseHex: string, tintHex: string, percentTint: number): string => {
  const t = percentTint / 100;
  const base = hexToOklab(baseHex);
  const tint = hexToOklab(tintHex);

  const baseC = Math.hypot(base.a, base.b);
  const tintC = Math.hypot(tint.a, tint.b);
  const alpha = base.alpha * (1 - t) + tint.alpha * t;
  const weighted = (x: number, y: number) =>
    alpha === 0 ? 0 : (x * base.alpha * (1 - t) + y * tint.alpha * t) / alpha;

  // An achromatic colour has no hue to contribute, so it borrows the other's.
  const baseH = baseC < 1e-6 ? null : Math.atan2(base.b, base.a) * (180 / Math.PI);
  const tintH = tintC < 1e-6 ? null : Math.atan2(tint.b, tint.a) * (180 / Math.PI);
  const from = baseH ?? tintH ?? 0;
  const to = tintH ?? baseH ?? 0;
  const hue = ((from + hueDelta(from, to) * t) * Math.PI) / 180;

  // A mix can land outside sRGB, so it maps the same way a conversion does.
  const rgb = gamutMap({
    l: weighted(base.L, tint.L),
    c: weighted(baseC, tintC),
    h: (hue * 180) / Math.PI,
  })
    .map(encodeGamma)
    .map(toByte)
    .join("");
  return alpha >= 1 ? `#${rgb}` : `#${rgb}${toByte(alpha)}`;
};
