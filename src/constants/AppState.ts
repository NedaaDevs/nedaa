import type { AppStateStatus } from "react-native";

/** React Native's app-state values the app reacts to. */
export const APP_STATE = {
  ACTIVE: "active",
  BACKGROUND: "background",
  INACTIVE: "inactive",
} as const satisfies Record<string, AppStateStatus>;
