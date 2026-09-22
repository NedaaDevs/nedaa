import { AppLocale } from "@/enums/app";

export type FontWeight = "regular" | "medium" | "semibold" | "bold";
type FaceSet = Record<FontWeight, string>;

const ARABIC_SCRIPT: FaceSet = {
  regular: "IBMPlexSansArabic-Regular",
  medium: "IBMPlexSansArabic-Medium",
  semibold: "IBMPlexSansArabic-SemiBold",
  bold: "IBMPlexSansArabic-Bold",
};

const LATIN_SCRIPT: FaceSet = {
  regular: "IBMPlexSans-Regular",
  medium: "IBMPlexSans-Medium",
  semibold: "IBMPlexSans-SemiBold",
  bold: "IBMPlexSans-Bold",
};

/** Every locale, so none falls back to a face without its script. */
export const FONT_MAPPINGS: Record<AppLocale, FaceSet> = {
  [AppLocale.AR]: ARABIC_SCRIPT,
  [AppLocale.UR]: ARABIC_SCRIPT,
  [AppLocale.EN]: LATIN_SCRIPT,
  [AppLocale.MS]: LATIN_SCRIPT,
};

export const DEFAULT_FACES = LATIN_SCRIPT;

export const isArabicScript = (locale: AppLocale): boolean =>
  FONT_MAPPINGS[locale] === ARABIC_SCRIPT;
