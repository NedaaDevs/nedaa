import type { NativeStackNavigationOptions } from "expo-router";

/** The stack presentations the app's screens ask for. */
export const PRESENTATION = {
  FULL_SCREEN_MODAL: "fullScreenModal",
} as const satisfies Record<string, NativeStackNavigationOptions["presentation"]>;
