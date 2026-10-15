import { useCallback, useMemo } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { HAPTIC_FEEDBACK, type HapticFeedback } from "@/constants/Haptics";
import { usePreferencesStore } from "@/stores/preferences";

const noop = () => Promise.resolve();

export const useHaptic = (feedbackType: HapticFeedback = HAPTIC_FEEDBACK.SELECTION) => {
  const hapticsEnabled = usePreferencesStore((s) => s.hapticsEnabled);

  const createHapticHandler = useCallback(
    (type: Haptics.ImpactFeedbackStyle) => {
      if (Platform.OS === "web" || !hapticsEnabled) {
        return noop;
      }
      return () => Haptics.impactAsync(type);
    },
    [hapticsEnabled]
  );

  const createNotificationFeedback = useCallback(
    (type: Haptics.NotificationFeedbackType) => {
      if (Platform.OS === "web" || !hapticsEnabled) {
        return noop;
      }
      return () => Haptics.notificationAsync(type);
    },
    [hapticsEnabled]
  );

  const hapticHandlers = useMemo(
    (): Record<HapticFeedback, () => Promise<void>> => ({
      [HAPTIC_FEEDBACK.LIGHT]: createHapticHandler(Haptics.ImpactFeedbackStyle.Light),
      [HAPTIC_FEEDBACK.MEDIUM]: createHapticHandler(Haptics.ImpactFeedbackStyle.Medium),
      [HAPTIC_FEEDBACK.HEAVY]: createHapticHandler(Haptics.ImpactFeedbackStyle.Heavy),
      [HAPTIC_FEEDBACK.SELECTION]:
        Platform.OS === "web" || !hapticsEnabled ? noop : Haptics.selectionAsync,
      [HAPTIC_FEEDBACK.SUCCESS]: createNotificationFeedback(
        Haptics.NotificationFeedbackType.Success
      ),
      [HAPTIC_FEEDBACK.WARNING]: createNotificationFeedback(
        Haptics.NotificationFeedbackType.Warning
      ),
      [HAPTIC_FEEDBACK.ERROR]: createNotificationFeedback(Haptics.NotificationFeedbackType.Error),
    }),
    [createHapticHandler, createNotificationFeedback, hapticsEnabled]
  );

  return hapticHandlers[feedbackType];
};
