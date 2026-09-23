import type { AppStateStatus } from "react-native";

/** React Native's app-state values the app reacts to. */
export const APP_STATE = { ACTIVE: "active" } as const satisfies Record<string, AppStateStatus>;
