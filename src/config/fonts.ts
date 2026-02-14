import { useFonts } from "expo-font";
import {
  NotoSansArabic_400Regular,
  NotoSansArabic_500Medium,
  NotoSansArabic_600SemiBold,
  NotoSansArabic_700Bold,
} from "@expo-google-fonts/noto-sans-arabic";
import {
  Asap_400Regular,
  Asap_500Medium,
  Asap_600SemiBold,
  Asap_700Bold,
} from "@expo-google-fonts/asap";

// Font family constants
export const FontFamily = {
  NotoSansArabic: "NotoSansArabic",
  Asap: "Asap",
};

// NotoSansArabic font weights
export const NotoSansArabicFonts = {
  400: "NotoSansArabic-Regular",
  500: "NotoSansArabic-Medium",
  600: "NotoSansArabic-SemiBold",
  700: "NotoSansArabic-Bold",
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
    // Noto Sans Arabic fonts
    "NotoSansArabic-Regular": NotoSansArabic_400Regular,
    "NotoSansArabic-Medium": NotoSansArabic_500Medium,
    "NotoSansArabic-SemiBold": NotoSansArabic_600SemiBold,
    "NotoSansArabic-Bold": NotoSansArabic_700Bold,

    // Asap fonts
    "Asap-Regular": Asap_400Regular,
    "Asap-Medium": Asap_500Medium,
    "Asap-SemiBold": Asap_600SemiBold,
    "Asap-Bold": Asap_700Bold,
  });
};
