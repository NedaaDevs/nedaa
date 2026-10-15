import { HAPTIC_FEEDBACK, type HapticFeedback } from "@/constants/Haptics";

const feedback = () => jest.fn(() => Promise.resolve());

/** One mock per feedback type, so a test checks which type fired. */
export const HAPTIC: Record<HapticFeedback, ReturnType<typeof feedback>> = {
  [HAPTIC_FEEDBACK.LIGHT]: feedback(),
  [HAPTIC_FEEDBACK.MEDIUM]: feedback(),
  [HAPTIC_FEEDBACK.HEAVY]: feedback(),
  [HAPTIC_FEEDBACK.SELECTION]: feedback(),
  [HAPTIC_FEEDBACK.SUCCESS]: feedback(),
  [HAPTIC_FEEDBACK.WARNING]: feedback(),
  [HAPTIC_FEEDBACK.ERROR]: feedback(),
};

/** Stands in for the hook: the same mock for a type on every render. */
export const useHaptic = (type: HapticFeedback = HAPTIC_FEEDBACK.SELECTION) => HAPTIC[type];

/** The types that fired since the last clear, for a test that allows one. */
export const firedHaptics = () =>
  Object.entries(HAPTIC)
    .filter(([, fire]) => fire.mock.calls.length > 0)
    .map(([type]) => type);

/** Clears every type's calls; run it in `beforeEach`. */
export const clearHaptics = () => Object.values(HAPTIC).forEach((fire) => fire.mockClear());
