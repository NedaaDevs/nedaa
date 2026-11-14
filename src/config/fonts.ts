import { useFonts } from "expo-font";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from "@expo-google-fonts/ibm-plex-sans";

import { ARABIC_FACES, LATIN_FACES } from "@/constants/Fonts";

/** Every font loaded before first paint, by the name a text style uses. */
export const APP_FONTS = {
  [ARABIC_FACES.regular]: IBMPlexSansArabic_400Regular,
  [ARABIC_FACES.medium]: IBMPlexSansArabic_500Medium,
  [ARABIC_FACES.semibold]: IBMPlexSansArabic_600SemiBold,
  [ARABIC_FACES.bold]: IBMPlexSansArabic_700Bold,

  [LATIN_FACES.regular]: IBMPlexSans_400Regular,
  [LATIN_FACES.medium]: IBMPlexSans_500Medium,
  [LATIN_FACES.semibold]: IBMPlexSans_600SemiBold,
  [LATIN_FACES.bold]: IBMPlexSans_700Bold,

  // Ornamental ayah/page markers + image-mushaf overlays (FD50 digit glyphs).
  UthmanicHafs: require("@/../assets/fonts/UthmanicHafs_V22.ttf"),
  // Quran text-reader body font: the flowing KFGQPC Hafs build (combining marks).
  Hafs: require("@/../assets/fonts/KFGQPC-HafsUthmanic.otf"),
  // Calligraphic surah-name ligatures, one font per mushaf version so the
  // header script matches the page ("surahNNN[ surah-icon]" → vocalized name glyph).
  "SurahNames-v1": require("@/../assets/fonts/SurahNames-v1.ttf"),
  "SurahNames-v2": require("@/../assets/fonts/SurahNames-v2.ttf"),
  "SurahNames-v4": require("@/../assets/fonts/SurahNames-v4.ttf"),
  // Juz-name ligatures + ornaments ("juzNNN" → vocalized juz name glyph).
  QuranCommon: require("@/../assets/fonts/QuranCommon.ttf"),
};

export const useLoadFonts = () => useFonts(APP_FONTS);
