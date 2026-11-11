import { PRAYER_ID } from "@/constants/Prayer";

/** The choices the calculation sheet holds, one at a time. */
export const CALCULATION_PICKER = {
  METHOD: "method",
  ASR: "asr",
  MIDNIGHT: "midnight",
  TUNING: "tuning",
} as const;

export type CalculationPicker = (typeof CALCULATION_PICKER)[keyof typeof CALCULATION_PICKER];

/** The choices the onboarding step offers; tuning stays in Settings. */
export const ONBOARDING_CALCULATION_PICKERS = [
  CALCULATION_PICKER.METHOD,
  CALCULATION_PICKER.ASR,
  CALCULATION_PICKER.MIDNIGHT,
] as const;

export type OnboardingCalculationPicker = (typeof ONBOARDING_CALCULATION_PICKERS)[number];

/** Each choice's name, on the row that opens it and atop its sheet. */
export const CALCULATION_TITLE_KEY: Record<CalculationPicker, string> = {
  [CALCULATION_PICKER.METHOD]: "providers.aladhan.method.title",
  [CALCULATION_PICKER.ASR]: "settings.calculation.asr.title",
  [CALCULATION_PICKER.MIDNIGHT]: "settings.calculation.midnight.title",
  [CALCULATION_PICKER.TUNING]: "settings.calculation.tuning.title",
};

/** The prayers the calculation preview shows: dawn, noon and night. */
export const PREVIEW_PRAYERS = [PRAYER_ID.FAJR, PRAYER_ID.DHUHR, PRAYER_ID.ISHA] as const;

/** Search params the Calculation screen reads. */
export const CALCULATION_PARAM = {
  /** A timing to open the adjustment sheet on, e.g. from a prayer's own sheet. */
  TUNE: "tune",
} as const;
