import { useEffect } from "react";
import { Appearance, useColorScheme } from "react-native";

import type { Phase } from "@/constants/Phase";
import { AppMode } from "@/enums/app";
import { useShownAppearance, type AppearanceInputs } from "@/hooks/useShownAppearance";
import { useAppStore } from "@/stores/app";
import { isDarkMode, nativeColorSchemeFor } from "@/utils/appearance";

export type RootAppearance = AppearanceInputs & { theme: AppMode.DARK | AppMode.LIGHT };

/** The root's shown phase, scheme and theme; it owns the native pin. */
export const useRootAppearance = (livePhase: Phase | undefined): RootAppearance => {
  const mode = useAppStore((state) => state.mode);
  const { phase, scheme } = useShownAppearance(mode, livePhase, useColorScheme());

  // Pin the native layer (system dialogs, keyboard, window bg) to the in-app
  // mode so it can't follow the OS day/night independently. useChooseMode
  // sets the same pin before a mode lands; this re-set is then a no-op.
  useEffect(() => {
    Appearance.setColorScheme(nativeColorSchemeFor(mode, phase));
  }, [mode, phase]);

  const theme = isDarkMode(mode, scheme, phase) ? AppMode.DARK : AppMode.LIGHT;
  return { phase, scheme, theme };
};
