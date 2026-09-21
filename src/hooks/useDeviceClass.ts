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

/** Takes the shorter edge, so a device does not change class when it rotates. */
export const resolveDeviceClass = (shorterEdgeDp: number): DeviceClass =>
  shorterEdgeDp >= EXPANDED_MIN_DP ? DEVICE_CLASS.EXPANDED : DEVICE_CLASS.COMPACT;

export const useDeviceClass = (): DeviceClass => {
  const { width, height } = useWindowDimensions();

  return resolveDeviceClass(Math.min(width, height));
};
