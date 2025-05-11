import { useFonts } from "expo-font";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";

// Font family constants
export const FontFamily = {
  IBM: "IBM",
  FREDOKA: "Fredoka",
};

// IBMPlexSans font weights
export const IBMPlexSansFonts = {
  400: "IBMPlexSans-Regular",
  500: "IBMPlexSans-Medium",
  600: "IBMPlexSans-SemiBold",
  700: "IBMPlexSans-Bold",
};

// Fredoka font weights
export const FredokaFonts = {
  400: "Fredoka-Regular",
  500: "Fredoka-Medium",
  600: "Fredoka-SemiBold",
  700: "Fredoka-Bold",
};

export const useLoadFonts = () => {
  return useFonts({
    // IBM Plex Sans Arabic fonts
    "IBMPlexSans-Regular": IBMPlexSansArabic_400Regular,
    "IBMPlexSans-Medium": IBMPlexSansArabic_500Medium,
    "IBMPlexSans-SemiBold": IBMPlexSansArabic_600SemiBold,
    "IBMPlexSans-Bold": IBMPlexSansArabic_700Bold,

    // Fredoka fonts
    "Fredoka-Regular": Fredoka_400Regular,
    "Fredoka-Medium": Fredoka_500Medium,
    "Fredoka-SemiBold": Fredoka_600SemiBold,
    "Fredoka-Bold": Fredoka_700Bold,
  });
};
