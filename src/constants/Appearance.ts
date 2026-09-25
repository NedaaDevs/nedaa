import type { Appearance } from "react-native";

/** React Native's colour schemes; UNSPECIFIED hands the choice to the OS. */
export const NATIVE_SCHEME = {
  LIGHT: "light",
  DARK: "dark",
  // "unspecified": "auto" needs React Native 0.88.
  UNSPECIFIED: "unspecified",
} as const satisfies Record<string, Parameters<typeof Appearance.setColorScheme>[0]>;

export type NativeScheme = (typeof NATIVE_SCHEME)[keyof typeof NATIVE_SCHEME];
