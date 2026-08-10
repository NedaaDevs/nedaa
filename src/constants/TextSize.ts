import { TextSize, type TextSizeValue } from "@/enums/app";

// Font multiplier each preset applies to React-rendered app text.
export const TEXT_SIZE_MULTIPLIERS: Record<TextSizeValue, number> = {
  [TextSize.DEFAULT]: 1.0,
  [TextSize.LARGE]: 1.15,
  [TextSize.XLARGE]: 1.3,
  [TextSize.MAX]: 1.5,
};

// The text-size offer (onboarding step, What's New entry) shows at or above
// this OS font scale — the first "large" step on Android.
export const OS_FONT_SCALE_OFFER_THRESHOLD = 1.15;

// Non-default presets, ordered small to large, for nearest-preset mapping.
const OFFERABLE: { value: TextSizeValue; m: number }[] = [
  { value: TextSize.LARGE, m: 1.15 },
  { value: TextSize.XLARGE, m: 1.3 },
  { value: TextSize.MAX, m: 1.5 },
];

/** Preset whose multiplier sits nearest the given OS font scale. */
export const nearestTextSize = (fontScale: number): TextSizeValue => {
  let best = OFFERABLE[0];
  for (const candidate of OFFERABLE) {
    if (Math.abs(candidate.m - fontScale) < Math.abs(best.m - fontScale)) best = candidate;
  }
  return best.value;
};
