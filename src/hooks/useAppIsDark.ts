import { usePhase } from "@/contexts/PhaseContext";
import { useAppScheme } from "@/contexts/SchemeContext";
import { useAppStore } from "@/stores/app";
import { isDarkMode } from "@/utils/appearance";

/** Whether the app is drawing dark right now. */
export const useAppIsDark = (): boolean => {
  const mode = useAppStore((state) => state.mode);
  const scheme = useAppScheme();
  return isDarkMode(mode, scheme, usePhase());
};
