import { Appearance } from "react-native";

import { useThemeTransition } from "@/components/ui/theme-transition/context";
import { NATIVE_SCHEME, PIN_REPORT_LIMIT_MS, type NativeScheme } from "@/constants/Appearance";
import { usePhase } from "@/contexts/PhaseContext";
import type { AppMode } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { nativeColorSchemeFor } from "@/utils/appearance";

/** Pins the native scheme; settles once the phone reports it, or at the limit. */
const pinNativeScheme = (next: NativeScheme): Promise<void> => {
  // A fixed pin the phone already reports has nothing to report.
  if (next !== NATIVE_SCHEME.UNSPECIFIED && next === Appearance.getColorScheme()) {
    Appearance.setColorScheme(next);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let limit: ReturnType<typeof setTimeout> | undefined;
    const subscription = Appearance.addChangeListener(() => settle());
    const settle = () => {
      clearTimeout(limit);
      subscription.remove();
      resolve();
    };
    limit = setTimeout(settle, PIN_REPORT_LIMIT_MS);
    Appearance.setColorScheme(next);
  });
};

/**
 * Applies an appearance mode under the theme dissolve. The native pin moves
 * first, so the phone's scheme is shown with the mode, not after the fade.
 */
export const useChooseMode = () => {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const phase = usePhase();
  const withThemeTransition = useThemeTransition();
  return async (next: AppMode) => {
    if (next === mode) return;
    await withThemeTransition(async () => {
      await pinNativeScheme(nativeColorSchemeFor(next, phase));
      setMode(next);
    });
  };
};
