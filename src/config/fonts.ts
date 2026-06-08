import { useFonts } from "expo-font";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import {
  Asap_400Regular,
  Asap_500Medium,
  Asap_600SemiBold,
  Asap_700Bold,
} from "@expo-google-fonts/asap";

// Font family constants
export const FontFamily = {
  IBM: "IBM",
  Asap: "Asap",
};

// IBMPlexSans font weights
export const IBMPlexSansFonts = {
  400: "IBMPlexSans-Regular",
  500: "IBMPlexSans-Medium",
  600: "IBMPlexSans-SemiBold",
  700: "IBMPlexSans-Bold",
};

// Asap font weights
export const AsapFonts = {
  400: "Asap-Regular",
  500: "Asap-Medium",
  600: "Asap-SemiBold",
  700: "Asap-Bold",
};

export const useLoadFonts = () => {
  return useFonts({
    // IBM Plex Sans Arabic fonts
    "IBMPlexSans-Regular": IBMPlexSansArabic_400Regular,
    "IBMPlexSans-Medium": IBMPlexSansArabic_500Medium,
    "IBMPlexSans-SemiBold": IBMPlexSansArabic_600SemiBold,
    "IBMPlexSans-Bold": IBMPlexSansArabic_700Bold,

    // Asap fonts
    "Asap-Regular": Asap_400Regular,
    "Asap-Medium": Asap_500Medium,
    "Asap-SemiBold": Asap_600SemiBold,
    "Asap-Bold": Asap_700Bold,

    // Ornamental ayah/page markers + image-mushaf overlays (FD50 digit glyphs).
    UthmanicHafs: require("@/../assets/fonts/UthmanicHafs_V22.ttf"),
    // Quran body-text fonts selectable in the text reader. Hafs is the flowing
    // KFGQPC build (combining marks); the others are lighter alternatives.
    Hafs: require("@/../assets/fonts/KFGQPC-HafsUthmanic.otf"),
    AmiriQuran: require("@/../assets/fonts/AmiriQuran-Regular.ttf"),
    ScheherazadeNew: require("@/../assets/fonts/ScheherazadeNew-Regular.ttf"),
  });
};
