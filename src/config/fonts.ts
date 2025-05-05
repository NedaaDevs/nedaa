import { useFonts } from "expo-font";
import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold } from "@expo-google-fonts/tajawal";
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
} from "@expo-google-fonts/roboto";

// Font family constants
export const FontFamily = {
  TAJAWAL: "Tajawal",
  ROBOTO: "Roboto",
};

// Tajwal font weights
export const TajwalFonts = {
  400: "Tajawal-Regular",
  500: "Tajawal-Medium",
  700: "Tajawal-Bold",
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
    // Tajawal fonts
    "Tajawal-Regular": Tajawal_400Regular,
    "Tajawal-Medium": Tajawal_500Medium,
    "Tajawal-Bold": Tajawal_700Bold,

    // Roboto fonts
    "Roboto-Regular": Roboto_400Regular,
    "Roboto-Medium": Roboto_500Medium,
    "Roboto-SemiBold": Roboto_600SemiBold,
    "Roboto-Bold": Roboto_700Bold,
  });
};
