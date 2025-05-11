import { useFonts } from "expo-font";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import {
  Wittgenstein_400Regular,
  Wittgenstein_500Medium,
  Wittgenstein_600SemiBold,
  Wittgenstein_700Bold,
} from "@expo-google-fonts/wittgenstein";

// Font family constants
export const FontFamily = {
  IBM: "IBM",
  Wittgenstein: "Wittgenstein",
};

// IBMPlexSans font weights
export const IBMPlexSansFonts = {
  400: "IBMPlexSans-Regular",
  500: "IBMPlexSans-Medium",
  600: "IBMPlexSans-SemiBold",
  700: "IBMPlexSans-Bold",
};

// Wittgenstein font weights
export const WittgensteinFonts = {
  400: "Wittgenstein-Regular",
  500: "Wittgenstein-Medium",
  600: "Wittgenstein-SemiBold",
  700: "Wittgenstein-Bold",
};

export const useLoadFonts = () => {
  return useFonts({
    // IBM Plex Sans Arabic fonts
    "IBMPlexSans-Regular": IBMPlexSansArabic_400Regular,
    "IBMPlexSans-Medium": IBMPlexSansArabic_500Medium,
    "IBMPlexSans-SemiBold": IBMPlexSansArabic_600SemiBold,
    "IBMPlexSans-Bold": IBMPlexSansArabic_700Bold,

    // Wittgenstein fonts
    "Wittgenstein-Regular": Wittgenstein_400Regular,
    "Wittgenstein-Medium": Wittgenstein_500Medium,
    "Wittgenstein-SemiBold": Wittgenstein_600SemiBold,
    "Wittgenstein-Bold": Wittgenstein_700Bold,
  });
};
