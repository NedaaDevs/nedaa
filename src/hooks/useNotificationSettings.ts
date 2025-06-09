import { useCallback, useMemo } from "react";
import { Platform } from "react-native";

// Stores
import { useNotificationStore } from "@/stores/notification";

// Types
import type {
  NotificationType,
  NotificationConfig,
  NotificationWithTiming,
} from "@/types/notification";
import { PlatformType } from "@/enums/app";
import { NOTIFICATION_TYPE } from "@/constants/Notification";

export const useNotificationSettings = () => {
  const {
    settings,
    isScheduling,
    updateAllNotificationToggle,
    updateQuickSetup,
    updateDefault,
    updateOverride,
    resetOverride,
    resetAllOverrides,
    scheduleAllNotifications,
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
    (prayerId: string, type: NotificationType) => {
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
    <T extends NotificationConfig>(
      prayerId: string,
      type: NotificationType
    ): T & { hasOverride: boolean } => {
      const config = getEffectiveConfigForPrayer<T>(prayerId, type);
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
    features,
    totalOverrideCount,

    // Actions
    updateAllNotificationToggle,
    updateQuickSetup,
    updateDefault,
    updateOverride,
    resetOverride,
    resetAllOverrides,
    scheduleAllNotifications,

    // Utilities
    prayerHasOverrides,
    getPrayerOverrideCount,
    hasOverride,
    getFormattedConfig,
    getEffectiveConfigForPrayer,
  };
};

// Hook for a specific prayer's settings
export const usePrayerNotificationSettings = (prayerId: string) => {
  const { settings, updateOverride, resetOverride, getEffectiveConfigForPrayer } =
    useNotificationStore();

  const hasOverride = useCallback(
    (type: NotificationType) => {
      return !!settings.overrides[prayerId]?.[type];
    },
    [settings.overrides, prayerId]
  );

  const prayerConfig = useMemo(
    () => ({
      prayer: getEffectiveConfigForPrayer<NotificationConfig>(prayerId, NOTIFICATION_TYPE.PRAYER),
      iqama: getEffectiveConfigForPrayer<NotificationWithTiming>(prayerId, NOTIFICATION_TYPE.IQAMA),
      preAthan: getEffectiveConfigForPrayer<NotificationWithTiming>(
        prayerId,
        NOTIFICATION_TYPE.PRE_ATHAN
      ),
    }),
    [prayerId, getEffectiveConfigForPrayer]
  );

  const overrides = useMemo(
    () => ({
      prayer: hasOverride(NOTIFICATION_TYPE.PRAYER),
      iqama: hasOverride(NOTIFICATION_TYPE.IQAMA),
      preAthan: hasOverride(NOTIFICATION_TYPE.PRE_ATHAN),
    }),
    [hasOverride]
  );

  return {
    config: prayerConfig,
    overrides,
    updateOverride: (type: NotificationType, config: any) => updateOverride(prayerId, type, config),
    resetOverride: (type: NotificationType) => resetOverride(prayerId, type),
  };
};
