import { useCallback, useMemo } from "react";
import { Platform } from "react-native";

// Stores
import { useNotificationStore } from "@/stores/notification";

// Types
import type { ConfigForType, PrayerNotificationType } from "@/types/notification";

// Enums
import { PlatformType } from "@/enums/app";

export const useNotificationSettings = () => {
  const {
    settings,
    isScheduling,
    fullAthanPlayback,
    athanAudioStream,
    fullIqamaPlayback,
    iqamaAudioStream,
    otherTimingNotifications,
    duhaTime,
    updateAllNotificationToggle,
    updateFullAthanPlayback,
    updateAthanAudioStream,
    updateFullIqamaPlayback,
    updateIqamaAudioStream,
    updateQuickSetup,
    updateDefault,
    updateOverride,
    replaceOverride,
    resetOverride,
    resetAllOverrides,
    scheduleAllNotifications,
    rescheduleIfNeeded,
    updateOtherTimingNotification,
    updateDuhaTime,
    getEffectiveConfigForPrayer,
  } = useNotificationStore();

  // Check if a specific prayer has overrides for any notification type
  const prayerHasOverrides = useCallback(
    (prayerId: string) => {
      return !!settings.overrides[prayerId];
    },
    [settings.overrides]
  );

  // Get override count for a prayer
  const getPrayerOverrideCount = useCallback(
    (prayerId: string) => {
      const overrides = settings.overrides[prayerId];
      if (!overrides) return 0;
      return Object.keys(overrides).length;
    },
    [settings.overrides]
  );

  // Check if a specific prayer/type combination has overrides
  const hasOverride = useCallback(
    (prayerId: string, type: PrayerNotificationType) => {
      return !!settings.overrides[prayerId]?.[type];
    },
    [settings.overrides]
  );

  // Get total count of all overrides
  const totalOverrideCount = useMemo(() => {
    return Object.values(settings.overrides).reduce(
      (total, prayerOverrides) => total + Object.keys(prayerOverrides).length,
      0
    );
  }, [settings.overrides]);

  // Platform-specific feature flags
  const features = useMemo(
    () => ({
      supportsVibration: Platform.OS === PlatformType.ANDROID,
      supportsCustomSounds: true,
    }),
    []
  );

  // Get formatted config for display
  const getFormattedConfig = useCallback(
    <T extends PrayerNotificationType>(
      prayerId: string,
      type: T
    ): ConfigForType<T> & { hasOverride: boolean } => {
      const config = getEffectiveConfigForPrayer(prayerId, type);
      const override = hasOverride(prayerId, type);

      return {
        ...config,
        hasOverride: override,
      };
    },
    [getEffectiveConfigForPrayer, hasOverride]
  );

  return {
    settings,
    isScheduling,
    fullAthanPlayback,
    athanAudioStream,
    fullIqamaPlayback,
    iqamaAudioStream,
    otherTimingNotifications,
    duhaTime,
    features,
    totalOverrideCount,

    // Actions
    updateAllNotificationToggle,
    updateFullAthanPlayback,
    updateAthanAudioStream,
    updateFullIqamaPlayback,
    updateIqamaAudioStream,
    updateQuickSetup,
    updateDefault,
    updateOverride,
    replaceOverride,
    resetOverride,
    resetAllOverrides,
    scheduleAllNotifications,
    rescheduleIfNeeded,
    updateOtherTimingNotification,
    updateDuhaTime,

    // Utilities
    prayerHasOverrides,
    getPrayerOverrideCount,
    hasOverride,
    getFormattedConfig,
    getEffectiveConfigForPrayer,
  };
};
