import { AppLocale } from "@/enums/app";

export type FontWeight = "regular" | "medium" | "semibold" | "bold";
type FaceSet = Record<FontWeight, string>;

/** Arabic script: Arabic, Urdu. */
export const ARABIC_FACES: FaceSet = {
  regular: "IBMPlexSansArabic-Regular",
  medium: "IBMPlexSansArabic-Medium",
  semibold: "IBMPlexSansArabic-SemiBold",
  bold: "IBMPlexSansArabic-Bold",
};

/** Latin script: English, Malay. */
export const LATIN_FACES: FaceSet = {
  regular: "IBMPlexSans-Regular",
  medium: "IBMPlexSans-Medium",
  semibold: "IBMPlexSans-SemiBold",
  bold: "IBMPlexSans-Bold",
};

/** Every locale, so none falls back to a face without its script. */
export const FONT_MAPPINGS: Record<AppLocale, FaceSet> = {
  [AppLocale.AR]: ARABIC_FACES,
  [AppLocale.UR]: ARABIC_FACES,
  [AppLocale.EN]: LATIN_FACES,
  [AppLocale.MS]: LATIN_FACES,
};

export const DEFAULT_FACES = LATIN_FACES;

export const isArabicScript = (locale: AppLocale): boolean =>
  FONT_MAPPINGS[locale] === ARABIC_FACES;

/** A face set as the theme's map from numeric weight to face. */
export const faceMapOf = (faces: FaceSet) => ({
  400: { normal: faces.regular },
  500: { normal: faces.medium },
  600: { normal: faces.semibold },
  700: { normal: faces.bold },
});
