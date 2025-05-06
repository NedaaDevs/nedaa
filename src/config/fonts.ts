import { useFonts } from "expo-font";
import { Zain_400Regular, Zain_700Bold } from "@expo-google-fonts/zain";
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
} from "@expo-google-fonts/roboto";

// Font family constants
export const FontFamily = {
  ZAIN: "Zain",
  ROBOTO: "Roboto",
};

// Zain font weights
export const ZainFonts = {
  400: "Zain-Regular",
  500: "Zain-Medium",
  700: "Zain-Bold",
};

// Roboto font weights
export const RobotoFonts = {
  400: "Roboto-Regular",
  500: "Roboto-Medium",
  600: "Roboto-SemiBold",
  700: "Roboto-Bold",
};

export const useLoadFonts = () => {
  return useFonts({
    // Zain fonts
    "Zain-Regular": Zain_400Regular,
    "Zain-Medium": Zain_400Regular, // Medium not available
    "Zain-Bold": Zain_700Bold,

    // Roboto fonts
    "Roboto-Regular": Roboto_400Regular,
    "Roboto-Medium": Roboto_500Medium,
    "Roboto-SemiBold": Roboto_600SemiBold,
    "Roboto-Bold": Roboto_700Bold,
  });
};
