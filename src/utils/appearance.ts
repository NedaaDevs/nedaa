import type { ColorSchemeName } from "react-native";

import { AppMode } from "@/enums/app";

// The native color scheme to force via Appearance.setColorScheme so OS-rendered
// surfaces (system dialogs, the keyboard, share sheets, the window background)
// match the in-app appearance. An explicit Light/Dark pins both the native and
// JS layers; "system" ("unspecified") hands control back to the OS. Without this
// the native layer follows the phone's day/night while the themed UI stays on the
// user's choice, leaving a mixed light/dark UI.
export const nativeColorSchemeFor = (mode: AppMode): ColorSchemeName => {
  switch (mode) {
    case AppMode.DARK:
      return "dark";
    case AppMode.LIGHT:
      return "light";
    default:
      return "unspecified";
  }
};
