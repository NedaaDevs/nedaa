import { useFonts } from "expo-font";
import { Zain_400Regular, Zain_700Bold } from "@expo-google-fonts/zain";
import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";

// Font family constants
export const FontFamily = {
  ZAIN: "Zain",
  FREDOKA: "Fredoka",
};

// Zain font weights
export const ZainFonts = {
  400: "Zain-Regular",
  500: "Zain-Medium",
  700: "Zain-Bold",
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
    // Zain fonts
    "Zain-Regular": Zain_400Regular,
    "Zain-Medium": Zain_400Regular, // Medium not available
    "Zain-Bold": Zain_700Bold,

    // Fredoka fonts
    "Fredoka-Regular": Fredoka_400Regular,
    "Fredoka-Medium": Fredoka_500Medium,
    "Fredoka-SemiBold": Fredoka_600SemiBold,
    "Fredoka-Bold": Fredoka_700Bold,
  });
};
