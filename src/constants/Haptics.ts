/** The kinds of haptic feedback `useHaptic` plays. */
export const HAPTIC_FEEDBACK = {
  LIGHT: "light",
  MEDIUM: "medium",
  HEAVY: "heavy",
  SELECTION: "selection",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
} as const;

export type HapticFeedback = (typeof HAPTIC_FEEDBACK)[keyof typeof HAPTIC_FEEDBACK];
