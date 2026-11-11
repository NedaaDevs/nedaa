import type { Appearance } from "react-native";

import { AppMode } from "@/enums/app";

/** React Native's colour schemes; AUTO hands the choice to the OS. */
export const NATIVE_SCHEME = {
  LIGHT: "light",
  DARK: "dark",
  AUTO: "auto",
} as const satisfies Record<string, Parameters<typeof Appearance.setColorScheme>[0]>;

export type NativeScheme = (typeof NATIVE_SCHEME)[keyof typeof NATIVE_SCHEME];

/** Longest wait for the phone to report a changed or released pin. */
export const PIN_REPORT_LIMIT_MS = 100;

/** The Appearance screen's rows, top to bottom, as the design lists them. */
export const APPEARANCE_ORDER = [
  AppMode.LIGHT,
  AppMode.DARK,
  AppMode.SYSTEM,
  AppMode.ADAPTIVE,
] as const satisfies readonly AppMode[];
