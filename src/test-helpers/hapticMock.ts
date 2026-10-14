import type { FeedbackType } from "@/hooks/useHaptic";

const feedback = () => jest.fn(() => Promise.resolve());

/** One mock per feedback type, so a test checks which type fired. */
export const HAPTIC: Record<FeedbackType, ReturnType<typeof feedback>> = {
  light: feedback(),
  medium: feedback(),
  heavy: feedback(),
  selection: feedback(),
  success: feedback(),
  warning: feedback(),
  error: feedback(),
};

/** Stands in for the hook: the same mock for a type on every render. */
export const useHaptic = (type: FeedbackType = "selection") => HAPTIC[type];

/** The types that fired since the last clear, for a test that allows one. */
export const firedHaptics = () =>
  Object.entries(HAPTIC)
    .filter(([, fire]) => fire.mock.calls.length > 0)
    .map(([type]) => type);

/** Clears every type's calls; run it in `beforeEach`. */
export const clearHaptics = () => Object.values(HAPTIC).forEach((fire) => fire.mockClear());
