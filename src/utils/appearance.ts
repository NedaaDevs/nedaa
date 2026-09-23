import type { ColorSchemeName } from "react-native";

import { AppMode } from "@/enums/app";

/** React Native's colour-scheme values, as the OS reports and accepts them. */
export const NATIVE_SCHEME = {
  LIGHT: "light",
  DARK: "dark",
  UNSPECIFIED: "unspecified",
} as const satisfies Record<string, ColorSchemeName>;

// The native color scheme to force via Appearance.setColorScheme so OS-rendered
// surfaces (system dialogs, the keyboard, share sheets, the window background)
// match the in-app appearance. An explicit Light/Dark pins both the native and
// JS layers; "system" ("unspecified") hands control back to the OS. Without this
// the native layer follows the phone's day/night while the themed UI stays on the
// user's choice, leaving a mixed light/dark UI.
export const nativeColorSchemeFor = (mode: AppMode): ColorSchemeName => {
  switch (mode) {
    case AppMode.DARK:
      return NATIVE_SCHEME.DARK;
    case AppMode.LIGHT:
      return NATIVE_SCHEME.LIGHT;
    default:
      return NATIVE_SCHEME.UNSPECIFIED;
  }
};

/** Whether the app draws dark: the chosen mode, or the phone's scheme under System. */
export const isDarkMode = (mode: AppMode, systemScheme: ColorSchemeName): boolean =>
  mode === AppMode.SYSTEM ? systemScheme === NATIVE_SCHEME.DARK : mode === AppMode.DARK;
