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

/** A family name with no font file of its own. */
type GenericFamily = "monospace" | "serif" | "sans-serif";

/** Android's monospace family. iOS has none and draws its system font. */
export const SYSTEM_MONO_FAMILY: GenericFamily = "monospace";

export const isArabicScript = (locale: AppLocale): boolean =>
  FONT_MAPPINGS[locale] === ARABIC_FACES;

/** Tamagui's font languages; `ARABIC` selects the `_ar` fonts. */
export const FONT_LANGUAGE = { DEFAULT: "default", ARABIC: "ar" } as const;
export type FontLanguageName = (typeof FONT_LANGUAGE)[keyof typeof FONT_LANGUAGE];

export const fontLanguageOf = (locale: AppLocale): FontLanguageName =>
  isArabicScript(locale) ? FONT_LANGUAGE.ARABIC : FONT_LANGUAGE.DEFAULT;

/** A face set as the theme's map from numeric weight to face. */
export const faceMapOf = (faces: FaceSet) => ({
  400: { normal: faces.regular },
  500: { normal: faces.medium },
  600: { normal: faces.semibold },
  700: { normal: faces.bold },
});
