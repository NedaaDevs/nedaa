import { AccessibilityInfo } from "react-native";

/** Queued on iOS: the keyboard's close moves focus, which cuts a plain line. */
export const announceMiss = (message: string) =>
  AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
