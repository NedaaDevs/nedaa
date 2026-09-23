import { useColorScheme } from "react-native";

import { usePhase } from "@/contexts/PhaseContext";
import { useAppStore } from "@/stores/app";
import { isDarkMode } from "@/utils/appearance";

/** Whether the app is drawing dark right now. */
export const useAppIsDark = (): boolean => {
  const mode = useAppStore((state) => state.mode);
  const systemScheme = useColorScheme();
  return isDarkMode(mode, systemScheme, usePhase());
};
