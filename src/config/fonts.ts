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

export const FontFamily = {
  Arabic: "IBMPlexSansArabic",
  Latin: "IBMPlexSans",
};

/** Arabic script: Arabic, Urdu. */
export const IBMPlexSansArabicFonts = {
  400: "IBMPlexSansArabic-Regular",
  500: "IBMPlexSansArabic-Medium",
  600: "IBMPlexSansArabic-SemiBold",
  700: "IBMPlexSansArabic-Bold",
};

/** Latin script: English, Malay. */
export const IBMPlexSansFonts = {
  400: "IBMPlexSans-Regular",
  500: "IBMPlexSans-Medium",
  600: "IBMPlexSans-SemiBold",
  700: "IBMPlexSans-Bold",
};

export const useLoadFonts = () => {
  return useFonts({
    "IBMPlexSansArabic-Regular": IBMPlexSansArabic_400Regular,
    "IBMPlexSansArabic-Medium": IBMPlexSansArabic_500Medium,
    "IBMPlexSansArabic-SemiBold": IBMPlexSansArabic_600SemiBold,
    "IBMPlexSansArabic-Bold": IBMPlexSansArabic_700Bold,

    "IBMPlexSans-Regular": IBMPlexSans_400Regular,
    "IBMPlexSans-Medium": IBMPlexSans_500Medium,
    "IBMPlexSans-SemiBold": IBMPlexSans_600SemiBold,
    "IBMPlexSans-Bold": IBMPlexSans_700Bold,

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
  });
};
