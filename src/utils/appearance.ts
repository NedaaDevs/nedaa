import type { ColorSchemeName } from "react-native";

import { BRIGHTNESS } from "@/constants/Palette";
import type { Phase } from "@/constants/Phase";
import { AppMode } from "@/enums/app";
import { PHASE_BRIGHTNESS } from "@/utils/phase";

/** React Native's colour-scheme values, as the OS reports and accepts them. */
export const NATIVE_SCHEME = {
  LIGHT: "light",
  DARK: "dark",
  UNSPECIFIED: "unspecified",
} as const satisfies Record<string, ColorSchemeName>;

// The native color scheme to force via Appearance.setColorScheme so OS-rendered
// surfaces (system dialogs, the keyboard, share sheets, the window background)
// match the in-app appearance. An explicit Light/Dark pins both the native and
// JS layers, and Adaptive pins the phase's brightness; System ("unspecified")
// hands control back to the OS, as does Adaptive before the phase is known.
export const nativeColorSchemeFor = (mode: AppMode, phase?: Phase): ColorSchemeName => {
  switch (mode) {
    case AppMode.DARK:
      return NATIVE_SCHEME.DARK;
    case AppMode.LIGHT:
      return NATIVE_SCHEME.LIGHT;
    case AppMode.ADAPTIVE:
      if (!phase) return NATIVE_SCHEME.UNSPECIFIED;
      return PHASE_BRIGHTNESS[phase] === BRIGHTNESS.DARK ? NATIVE_SCHEME.DARK : NATIVE_SCHEME.LIGHT;
    default:
      return NATIVE_SCHEME.UNSPECIFIED;
  }
};

/**
 * Whether the app draws dark: the chosen mode, the phone's scheme under System, or
 * the phase under Adaptive — which follows the phone until the phase is known.
 */
export const isDarkMode = (
  mode: AppMode,
  systemScheme: ColorSchemeName,
  phase?: Phase
): boolean => {
  if (mode === AppMode.ADAPTIVE && phase) return PHASE_BRIGHTNESS[phase] === BRIGHTNESS.DARK;
  if (mode === AppMode.SYSTEM || mode === AppMode.ADAPTIVE) {
    return systemScheme === NATIVE_SCHEME.DARK;
  }
  return mode === AppMode.DARK;
};
