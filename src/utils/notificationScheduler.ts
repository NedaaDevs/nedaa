import { Platform } from "react-native";
import {
  isSameDay,
  isAfter,
  addMinutes,
  subMinutes,
  parseISO,
  differenceInSeconds,
} from "date-fns";

import i18next from "@/localization/i18n";

// Utils
import {
  scheduleNotification,
  cancelAllScheduledNotifications,
  checkPermissions,
  scheduleRecurringNotification,
} from "@/utils/notifications";
import { timeZonedNow } from "@/utils/date";
import { scheduleQadaNotifications } from "@/utils/qadaNotificationScheduler";

// Types
import type { NotificationContentInput } from "expo-notifications";
import {
  AthkarNotificationSettings,
  NotificationSettings,
  NotificationType,
  getEffectiveConfig,
} from "@/types/notification";
import { PrayerName, DayPrayerTimes } from "@/types/prayerTimes";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { isAthanSound } from "@/constants/sounds";

// Enums
import { PermissionStatus } from "expo-notifications";
import { PlatformType } from "@/enums/app";

// Stores
import { useCustomSoundsStore } from "@/stores/customSounds";

// Native modules
import { scheduleAthan, cancelAllAthans } from "expo-alarm";

// Utils
import { createNotificationChannels, getNotificationChannelId } from "@/utils/notificationChannels";
import { getNotificationSound } from "@/utils/sound";
import { isCustomSoundKey } from "@/utils/customSoundHelpers";
import { formatNumberToLocale } from "@/utils/number";
import { ATHKAR_TYPE } from "@/constants/Athkar";

type SchedulingOptions = {
  daysToSchedule?: number;
  force?: boolean;
  timezone: string;
};

type SchedulingResult = {
  success: boolean;
  scheduledCount: number;
  error?: Error;
};

type NotificationScheduleItem = {
  id: string;
  time: Date;
  title: string;
  body: string;
  type: NotificationType;
  prayerId: PrayerName;
  sound: string | false;
  soundKey?: string;
  vibration: boolean;
  categoryId: string;
  channelId?: string;
};

const PRAYER_IDS: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const MAX_IOS_NOTIFICATIONS = 63;
const DEFAULT_DAYS_TO_SCHEDULE = 10;
const MIN_INTERVAL_SECONDS = 60; // Minimum 1 minute

const scheduleAthkarNotifications = async (
  athkarSettings: {
    morningNotification: AthkarNotificationSettings;
    eveningNotification: AthkarNotificationSettings;
  },
  timezone: string,
  t: typeof i18next.t
): Promise<{ success: boolean; scheduledCount: number }> => {
  let scheduledCount = 0;

  try {
    // Schedule Morning Athkar if enabled
    if (athkarSettings.morningNotification.enabled) {
      const morningResult = await scheduleRecurringNotification(
        athkarSettings.morningNotification.hour,
        athkarSettings.morningNotification.minute || 0,
        {
          title: t("notification.athkar.morning.title"),
          body: t("notification.athkar.morning.body"),
          sound: "default",
          data: {
            type: "ATHKAR",
            athkarType: ATHKAR_TYPE.MORNING,
            screen: "/(tabs)/athkar",
          },
        },
        {
          vibrate: true,
          categoryId: "athkar_morning",
          channelId: Platform.OS === PlatformType.ANDROID ? "athkar_morning" : undefined,
          timezone,
        }
      );

      if (morningResult.success) {
        scheduledCount++;
        console.log(
          `[AthkarScheduler] Scheduled morning Athkar at ${athkarSettings.morningNotification.hour}:${athkarSettings.morningNotification.minute || 0}`
        );
      } else {
        console.error(
          `[AthkarScheduler] Failed to schedule morning Athkar: ${morningResult.message}`
        );
      }
    }

    // Schedule Evening Athkar if enabled
    if (athkarSettings.eveningNotification.enabled) {
      const eveningResult = await scheduleRecurringNotification(
        athkarSettings.eveningNotification.hour,
        athkarSettings.eveningNotification.minute || 0,
        {
          title: t("notification.athkar.evening.title"),
          body: t("notification.athkar.evening.body"),
          sound: "default",
          data: {
            type: "ATHKAR",
            athkarType: ATHKAR_TYPE.EVENING,
            screen: "/(tabs)/athkar",
          },
        },
        {
          vibrate: true,
          categoryId: "athkar_evening",
          channelId: Platform.OS === PlatformType.ANDROID ? "athkar_evening" : undefined,
          timezone,
        }
      );

      if (eveningResult.success) {
        scheduledCount++;
        console.log(
          `[AthkarScheduler] Scheduled evening Athkar at ${athkarSettings.eveningNotification.hour}:${athkarSettings.eveningNotification.minute || 0}`
        );
      } else {
        console.error(
          `[AthkarScheduler] Failed to schedule evening Athkar: ${eveningResult.message}`
        );
      }
    }

    return { success: true, scheduledCount };
  } catch (error) {
    console.error("[AthkarScheduler] Failed to schedule Athkar notifications:", error);
    return { success: false, scheduledCount: 0 };
  }
};

/**
 * Schedule all notifications based on settings and prayer times
 */
export const scheduleAllNotifications = async (
  settings: NotificationSettings,
  athkarSettings: {
    morningNotification: AthkarNotificationSettings;
    eveningNotification: AthkarNotificationSettings;
  },
  data: DayPrayerTimes[] | null,
  timezone: string,
  qadaSettings: { settings: any; remainingCount: number } | null = null,
  androidOptions: { fullAthanPlayback?: boolean } = {},
  options: Partial<SchedulingOptions> = {}
): Promise<SchedulingResult> => {
  if ((await checkPermissions()).status !== PermissionStatus.GRANTED) {
    console.warn(
      "[NotificationScheduler] Notification permission not granted, skipping scheduling"
    );
    return {
      success: false,
      scheduledCount: 0,
      error: new Error("Notification permission not granted"),
    };
  }

  if (!data) {
    console.log("No data to schedule");
    return {
      success: false,
      scheduledCount: 0,
    };
  }

  const { t } = i18next;

  if (!settings.enabled) {
    return { success: true, scheduledCount: 0 };
  }

  try {
    // Get custom sounds (Android only, empty array for iOS)
    const storeState = useCustomSoundsStore.getState();
    const customSounds = Platform.OS === PlatformType.ANDROID ? storeState.customSounds : [];

    if (Platform.OS === PlatformType.ANDROID) {
      // Always recreate channels — Android caches deleted channel settings (zombie channels),
      // and expo-notifications serializes all custom sounds as "custom" making diff unreliable.
      const fullAthanPlayback = androidOptions.fullAthanPlayback ?? false;
      await createNotificationChannels(settings, customSounds, athkarSettings, fullAthanPlayback);
    }

    // Cancel all pending athan service alarms (Android)
    const fullAthanEnabled =
      Platform.OS === PlatformType.ANDROID && (androidOptions.fullAthanPlayback ?? false);
    if (Platform.OS === PlatformType.ANDROID) {
      await cancelAllAthans([]);
    }

    await cancelAllScheduledNotifications();

    // Determine scheduling period
    const daysToSchedule = options.daysToSchedule || DEFAULT_DAYS_TO_SCHEDULE;
    const now = timeZonedNow(timezone);

    const daysPrayerTimes = data;

    if (!daysPrayerTimes || daysPrayerTimes.length === 0) {
      throw new Error("No prayer times available for scheduling");
    }

    // Collect all notifications to schedule
    const notificationsToSchedule: NotificationScheduleItem[] = [];

    //  for each day
    for (const dayPrayerTimes of daysPrayerTimes) {
      //  for each prayer
      for (const prayerId of PRAYER_IDS) {
        const prayerTimeString = dayPrayerTimes.timings[prayerId];
        if (!prayerTimeString) continue;

        const prayerDate = parseISO(prayerTimeString);

        // Skip prayers that have already passed
        if (!isAfter(prayerDate, now)) continue;

        // Generate notifications for this prayer with its settings
        const prayerNotifications = generatePrayerNotifications(
          prayerId,
          prayerDate,
          settings,
          now,
          t,
          false,
          fullAthanEnabled
        );

        notificationsToSchedule.push(...prayerNotifications);
      }
    }

    await scheduleAthkarNotifications(athkarSettings, timezone, t);

    if (qadaSettings && qadaSettings.settings) {
      await scheduleQadaNotifications(
        qadaSettings.settings,
        qadaSettings.remainingCount,
        t,
        settings,
        customSounds
      );
    }

    // Sort notifications by time
    notificationsToSchedule.sort((a, b) => a.time.getTime() - b.time.getTime());

    // Calculate how many Athkar notifications are taking up slots
    const athkarNotificationCount =
      (athkarSettings.morningNotification.enabled ? 1 : 0) +
      (athkarSettings.eveningNotification.enabled ? 1 : 0);

    // Calculate qada notification count (1 if enabled, 0 if disabled)
    const qadaNotificationCount = settings.defaults.qada.enabled ? 1 : 0;

    // Apply iOS limit(64 scheduled notifications max)
    let notificationsToProcess = notificationsToSchedule;
    if (Platform.OS === PlatformType.IOS) {
      const maxAllowed = MAX_IOS_NOTIFICATIONS - athkarNotificationCount - qadaNotificationCount;

      if (notificationsToSchedule.length > maxAllowed) {
        notificationsToProcess = notificationsToSchedule.slice(0, maxAllowed);
      }
    }
    // Add reminder notification only if we have notifications to schedule
    if (notificationsToProcess.length > 0) {
      const lastNotification = notificationsToProcess[notificationsToProcess.length - 1];
      const reminderTime = addMinutes(lastNotification.time, 10); // 10 minutes after last notification

      notificationsToProcess.push({
        id: "reminder",
        time: reminderTime,
        title: t("notification.reminder.title"),
        body: t("notification.reminder.body"),
        type: NOTIFICATION_TYPE.PRAYER,
        prayerId: "fajr",
        categoryId: "reminder",
        vibration: true,
        sound: "default",
      });
    }

    let scheduledCount = 0;
    for (const notification of notificationsToProcess) {
      const notificationInput: NotificationContentInput = {
        title: notification.title,
        body: notification.body,
        data: {
          type: notification.type,
          prayerId: notification.prayerId,
          categoryId: notification.categoryId,
        },
        sound: notification.sound,
      };

      const result = await scheduleNotification(notification.time, notificationInput, {
        vibrate: Platform.OS === PlatformType.ANDROID ? notification.vibration : false,
        categoryId: notification.categoryId,
        channelId: notification.channelId,
      });

      if (result.success) {
        scheduledCount++;

        // Schedule native athan service for prayer notifications with athan sounds (Android)
        // Only when fullAthanPlayback is enabled — otherwise the channel plays the sound
        if (
          fullAthanEnabled &&
          notification.type === NOTIFICATION_TYPE.PRAYER &&
          notification.soundKey &&
          isAthanSound(notification.soundKey)
        ) {
          const athanId = `athan_${notification.prayerId}_${notification.time.getTime()}`;
          // Resolve the actual sound file name for the native service.
          // notification.sound is "default" for athan sounds (intended for the notification content),
          // but the native AthanService needs the real resource name (e.g. "makkah_athan1.ogg")
          // or a content:// URI for custom sounds.
          const allCustomSounds = useCustomSoundsStore.getState().customSounds;
          const isCustom = isCustomSoundKey(notification.soundKey);
          const athanSoundName = isCustom
            ? (allCustomSounds.find((s) => s.id === notification.soundKey)?.contentUri ??
              notification.soundKey)
            : (getNotificationSound(NOTIFICATION_TYPE.PRAYER, notification.soundKey) ??
              notification.soundKey);

          await scheduleAthan({
            id: athanId,
            triggerDate: notification.time,
            prayerId: notification.prayerId,
            soundName: athanSoundName,
            title: notification.title,
            stopLabel: t("common.stop"),
          });
        }
      }
    }
    scheduledCount = scheduledCount + athkarNotificationCount + qadaNotificationCount;
    console.log(`[NotificationScheduler] Successfully scheduled ${scheduledCount} notifications`);
    return { success: true, scheduledCount };
  } catch (error) {
    console.error("Failed to schedule notifications:", error);
    return {
      success: false,
      scheduledCount: 0,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
};

/**
 * Generate all notification items for a single prayer
 */
const generatePrayerNotifications = (
  prayerId: PrayerName,
  prayerTime: Date,
  settings: NotificationSettings,
  now: Date,
  t: typeof i18next.t,
  testMode: boolean = false,
  fullAthanEnabled: boolean = false
): NotificationScheduleItem[] => {
  const notifications: NotificationScheduleItem[] = [];
  const prayerName = t(`prayerTimes.${formatPrayerName(prayerId, prayerTime)}`);

  // Get effective configs for all notification types
  const prayerConfig = getEffectiveConfig(
    prayerId,
    NOTIFICATION_TYPE.PRAYER,
    settings.defaults,
    settings.overrides
  );
  const iqamaConfig = getEffectiveConfig(
    prayerId,
    NOTIFICATION_TYPE.IQAMA,
    settings.defaults,
    settings.overrides
  );
  const preAthanConfig = getEffectiveConfig(
    prayerId,
    NOTIFICATION_TYPE.PRE_ATHAN,
    settings.defaults,
    settings.overrides
  );

  // Pre-Athan notification
  if (preAthanConfig.enabled) {
    const preAthanTime = subMinutes(prayerTime, preAthanConfig.timing);
    if (isAfter(preAthanTime, now)) {
      const secondsFromNow = differenceInSeconds(preAthanTime, now);

      // Only schedule if interval is at least MIN_INTERVAL_SECONDS (skip in test mode)
      if (testMode || secondsFromNow >= MIN_INTERVAL_SECONDS) {
        // Generate dynamic channel ID based on sound
        const preAthanChannelId = getNotificationChannelId(
          prayerId,
          NOTIFICATION_TYPE.PRE_ATHAN,
          preAthanConfig.sound
        );

        notifications.push({
          id: `preathan_${prayerId}_${prayerTime.getTime()}`,
          time: preAthanTime,
          title: t("notification.preAthan.title"),
          body: formatNumberToLocale(
            t("notification.preAthan.body", {
              count: preAthanConfig.timing,
              prayerName,
            })
          ),
          type: NOTIFICATION_TYPE.PRE_ATHAN,
          prayerId,
          categoryId: `preathan_${prayerId}`,
          channelId: preAthanChannelId,
          vibration: preAthanConfig.vibration,
          sound:
            getNotificationSound(NOTIFICATION_TYPE.PRE_ATHAN, preAthanConfig.sound) || "default",
        });
      }
    }
  }

  // Prayer notification
  if (prayerConfig.enabled) {
    const secondsFromNow = differenceInSeconds(prayerTime, now);

    // Only schedule if interval is at least MIN_INTERVAL_SECONDS (skip in test mode)
    if (testMode || secondsFromNow >= MIN_INTERVAL_SECONDS) {
      // Generate dynamic channel ID based on sound
      // Pass silenced flag to match the channel ID created in notificationChannels.ts
      const silenceChannel = isAthanSound(prayerConfig.sound) && fullAthanEnabled;
      const prayerChannelId = getNotificationChannelId(
        prayerId,
        NOTIFICATION_TYPE.PRAYER,
        prayerConfig.sound,
        silenceChannel
      );

      // When fullAthanPlayback is ON: athan sounds play via AthanService — notification must be silent
      // When fullAthanPlayback is OFF (or iOS): pass the actual sound file to play with the notification
      const prayerSound =
        isAthanSound(prayerConfig.sound) && fullAthanEnabled
          ? false
          : getNotificationSound(NOTIFICATION_TYPE.PRAYER, prayerConfig.sound) || "default";

      notifications.push({
        id: `prayer_${prayerId}_${prayerTime.getTime()}`,
        time: prayerTime,
        title: t("notification.prayer.title", { prayerName }),
        body: t("notification.prayer.body", { prayerName }),
        type: NOTIFICATION_TYPE.PRAYER,
        prayerId,
        categoryId: `prayer_${prayerId}`,
        channelId: prayerChannelId,
        vibration: prayerConfig.vibration,
        sound: prayerSound,
        soundKey: prayerConfig.sound,
      });
    }
  }

  // Iqama notification
  if (iqamaConfig.enabled) {
    const iqamaTime = addMinutes(prayerTime, iqamaConfig.timing);
    const secondsFromNow = differenceInSeconds(iqamaTime, now);

    // Only schedule if interval is at least MIN_INTERVAL_SECONDS and in the future (skip in test mode)
    if (testMode || secondsFromNow >= MIN_INTERVAL_SECONDS) {
      // Generate dynamic channel ID based on sound
      const iqamaChannelId = getNotificationChannelId(
        prayerId,
        NOTIFICATION_TYPE.IQAMA,
        iqamaConfig.sound
      );

      notifications.push({
        id: `iqama_${prayerId}_${prayerTime.getTime()}`,
        time: iqamaTime,
        title: t("notification.iqama.title", {
          prayerName,
        }),
        body: formatNumberToLocale(
          t("notification.iqama.body", {
            count: iqamaConfig.timing,
            prayerName,
          })
        ),
        type: NOTIFICATION_TYPE.IQAMA,
        prayerId,
        categoryId: `iqama_${prayerId}`,
        channelId: iqamaChannelId,
        vibration: iqamaConfig.vibration,
        sound: getNotificationSound(NOTIFICATION_TYPE.IQAMA, iqamaConfig.sound) || "default",
      });
    }
  }

  return notifications;
};

/**
 * Translation key for prayer name for display
 */
const formatPrayerName = (prayerId: PrayerName, date?: Date): string => {
  // Special case for Jumu'ah (Friday Dhuhr)
  const checkDate = date || new Date();
  if (checkDate.getDay() === 5 && prayerId === "dhuhr") {
    return "jumuah";
  }

  return prayerId;
};

/**
 * Check if rescheduling is needed based on the last scheduled date
 */
export const shouldReschedule = (
  lastScheduledDate: string | null,
  force: boolean = false
): boolean => {
  if (force) return true;

  if (!lastScheduledDate) return true;

  const now = new Date();
  const lastScheduled = new Date(lastScheduledDate);

  return !isSameDay(lastScheduled, now);
};

/**
 * For Debugging
 * Calculate how many notifications would be scheduled for given settings
 */
export const calculateNotificationCount = (
  settings: NotificationSettings,
  athkarSettings: {
    morningNotification: AthkarNotificationSettings;
    eveningNotification: AthkarNotificationSettings;
  },
  days: number,
  prayersPerDay: number = 5
): number => {
  let count = 0;

  for (let day = 0; day < days; day++) {
    for (let prayer = 0; prayer < prayersPerDay; prayer++) {
      if (settings.defaults.prayer.enabled) count++;
      if (settings.defaults.iqama.enabled) count++;
      if (settings.defaults.preAthan.enabled) count++;
    }
  }
  let athkarCount = 0;
  for (let day = 0; day < days; day++) {
    if (athkarSettings.morningNotification.enabled) athkarCount++;
    if (athkarSettings.eveningNotification.enabled) athkarCount++;
  }

  return count + athkarCount;
};

/**
 * For Debugging
 * Get estimated days that can be scheduled within iOS limit
 *
 */
export const getMaxSchedulableDays = (
  settings: NotificationSettings,
  athkarSettings: {
    morningNotification: AthkarNotificationSettings;
    eveningNotification: AthkarNotificationSettings;
  },
  prayersPerDay: number = 5
): number => {
  const notificationsPerDay = calculateNotificationCount(
    settings,
    athkarSettings,
    1,
    prayersPerDay
  );

  if (notificationsPerDay === 0) return Infinity;

  return Math.floor(MAX_IOS_NOTIFICATIONS / notificationsPerDay);
};
