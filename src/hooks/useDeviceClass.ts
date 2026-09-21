import { useWindowDimensions } from "react-native";

/** Two canvases: COMPACT is one column, EXPANDED has room to arrange. */
export const DEVICE_CLASS = {
  COMPACT: "compact",
  EXPANDED: "expanded",
} as const;

export type DeviceClass = (typeof DEVICE_CLASS)[keyof typeof DEVICE_CLASS];

/**
 * 560, not 600: the iPhone Duo's inner display is 626pt, and 600 would leave 26pt —
 * one reserved inset from flipping mid-session. The Quran reader keeps its own
 * LARGE_DEVICE_MIN_DP.
 */
export const EXPANDED_MIN_DP = 560;

/** Reads the shorter edge of the WINDOW, so orientation does not change the class. */
export const resolveDeviceClass = (window: { width: number; height: number }): DeviceClass =>
  Math.min(window.width, window.height) >= EXPANDED_MIN_DP
    ? DEVICE_CLASS.EXPANDED
    : DEVICE_CLASS.COMPACT;

export const useDeviceClass = (): DeviceClass => resolveDeviceClass(useWindowDimensions());
