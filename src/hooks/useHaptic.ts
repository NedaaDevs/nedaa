import { useCallback, useMemo } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { usePreferencesStore } from "@/stores/preferences";

type FeedbackType = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

const noop = () => Promise.resolve();

export const useHaptic = (feedbackType: FeedbackType = "selection") => {
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
    () => ({
      light: createHapticHandler(Haptics.ImpactFeedbackStyle.Light),
      medium: createHapticHandler(Haptics.ImpactFeedbackStyle.Medium),
      heavy: createHapticHandler(Haptics.ImpactFeedbackStyle.Heavy),
      selection: Platform.OS === "web" || !hapticsEnabled ? noop : Haptics.selectionAsync,
      success: createNotificationFeedback(Haptics.NotificationFeedbackType.Success),
      warning: createNotificationFeedback(Haptics.NotificationFeedbackType.Warning),
      error: createNotificationFeedback(Haptics.NotificationFeedbackType.Error),
    }),
    [createHapticHandler, createNotificationFeedback, hapticsEnabled]
  );

  return hapticHandlers[feedbackType];
};
