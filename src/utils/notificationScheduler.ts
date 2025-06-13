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
} from "@/utils/notifications";
import { timeZonedNow } from "@/utils/date";

// Types
import type { NotificationContentInput } from "expo-notifications";
import { NotificationSettings, NotificationType, getEffectiveConfig } from "@/types/notification";
import { PrayerName, DayPrayerTimes } from "@/types/prayerTimes";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Enums
import { PermissionStatus } from "expo-notifications";
import { PlatformType } from "@/enums/app";

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
  sound: string;
  vibration: boolean;
  categoryId: string;
};

const PRAYER_IDS: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const MAX_IOS_NOTIFICATIONS = 63;
const DEFAULT_DAYS_TO_SCHEDULE = 10;
const MIN_INTERVAL_SECONDS = 60; // Minimum 1 minute

/**
 * Schedule all notifications based on settings and prayer times
 */
export const scheduleAllNotifications = async (
  settings: NotificationSettings,
  data: DayPrayerTimes[] | null,
  timezone: string,
  options: Partial<SchedulingOptions> = {}
): Promise<SchedulingResult> => {
  if ((await checkPermissions()).status !== PermissionStatus.GRANTED) {
    console.warn("[NotificationScheduler] Notification Permission not granted cancel scheduling");
    return {
      success: false,
      scheduledCount: 0,
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

  console.log("[NotificationScheduler] Starting notification scheduling...");

  if (!settings.enabled) {
    return { success: true, scheduledCount: 0 };
  }

  try {
    // Cancel all existing notifications
    console.log("[NotificationScheduler] Cancelling existing notifications...");
    await cancelAllScheduledNotifications();

    // Determine scheduling period
    const daysToSchedule = options.daysToSchedule || DEFAULT_DAYS_TO_SCHEDULE;
    const now = timeZonedNow(timezone);

    // Get prayer times for the date range
    console.log(`[NotificationScheduler] Fetching prayer times for ${daysToSchedule} days...`);
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
          t
        );

        notificationsToSchedule.push(...prayerNotifications);
      }
    }

    // Sort notifications by time
    notificationsToSchedule.sort((a, b) => a.time.getTime() - b.time.getTime());

    // Apply iOS limit(64 scheduled notifications max)
    let notificationsToProcess = notificationsToSchedule;
    if (
      Platform.OS === PlatformType.IOS &&
      notificationsToSchedule.length > MAX_IOS_NOTIFICATIONS
    ) {
      // Keep only first 63 notifications(64th as a reminder)
      notificationsToProcess = notificationsToSchedule.slice(0, MAX_IOS_NOTIFICATIONS);
    }

    // Add reminder notification(Reserves the last notification as a reminder)
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

    // Schedule all notifications
    console.log(
      `[NotificationScheduler] Scheduling ${notificationsToProcess.length} notifications...`
    );
    let scheduledCount = 0;
    for (const notification of notificationsToProcess) {
      const notificationInput: NotificationContentInput = {
        ...notification,
      };

      const result = await scheduleNotification(notification.time, notificationInput, {
        vibrate: Platform.OS === PlatformType.ANDROID ? notification.vibration : false,
        categoryId: notification.categoryId,
      });

      if (result.success) {
        scheduledCount++;
      }
    }

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
  t: typeof i18next.t
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

      // Only schedule if interval is at least MIN_INTERVAL_SECONDS
      if (secondsFromNow >= MIN_INTERVAL_SECONDS) {
        notifications.push({
          id: `preathan_${prayerId}_${prayerTime.getTime()}`,
          time: preAthanTime,
          title: t("notification.preAthan.title", {
            minutes: preAthanConfig.timing,
            prayerName,
          }),
          body: t("notification.preAthan.body", {
            minutes: preAthanConfig.timing,
            prayerName,
          }),
          type: NOTIFICATION_TYPE.PRE_ATHAN,
          prayerId,
          categoryId: `preathan_${prayerId}`,
          vibration: preAthanConfig.vibration,
          sound: preAthanConfig.sound,
        });
      }
    }
  }

  // Prayer notification
  if (prayerConfig.enabled) {
    const secondsFromNow = differenceInSeconds(prayerTime, now);

    // Only schedule if interval is at least MIN_INTERVAL_SECONDS
    if (secondsFromNow >= MIN_INTERVAL_SECONDS) {
      notifications.push({
        id: `prayer_${prayerId}_${prayerTime.getTime()}`,
        time: prayerTime,
        title: t("notification.prayer.title", {
          prayerName,
        }),
        body: t("notification.prayer.body", {
          prayerName,
        }),
        type: NOTIFICATION_TYPE.PRAYER,
        prayerId,
        categoryId: `prayer_${prayerId}`,
        vibration: prayerConfig.vibration,
        sound: prayerConfig.sound,
      });
    }
  }

  // Iqama notification
  if (iqamaConfig.enabled) {
    const iqamaTime = addMinutes(prayerTime, iqamaConfig.timing);
    const secondsFromNow = differenceInSeconds(iqamaTime, now);

    // Only schedule if interval is at least MIN_INTERVAL_SECONDS and in the future
    if (secondsFromNow >= MIN_INTERVAL_SECONDS) {
      notifications.push({
        id: `iqama_${prayerId}_${prayerTime.getTime()}`,
        time: iqamaTime,
        title: t("notification.iqama.title", {
          prayerName,
        }),
        body: t("notification.iqama.body", {
          minutes: iqamaConfig.timing,
          prayerName,
        }),
        type: NOTIFICATION_TYPE.IQAMA,
        prayerId,
        categoryId: `iqama_${prayerId}`,
        vibration: iqamaConfig.vibration,
        sound: iqamaConfig.sound,
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

  return count;
};

/**
 * For Debugging
 * Get estimated days that can be scheduled within iOS limit
 *
 */
export const getMaxSchedulableDays = (
  settings: NotificationSettings,
  prayersPerDay: number = 5
): number => {
  const notificationsPerDay = calculateNotificationCount(settings, 1, prayersPerDay);

  if (notificationsPerDay === 0) return Infinity;

  return Math.floor(MAX_IOS_NOTIFICATIONS / notificationsPerDay);
};
