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
