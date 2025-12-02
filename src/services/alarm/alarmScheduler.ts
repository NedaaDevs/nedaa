import { Platform } from "react-native";
import { addDays, setHours, setMinutes, setSeconds, setMilliseconds, isBefore } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

import i18n from "@/localization/i18n";

// DB
import { PrayerTimesDB } from "@/services/db";

// Native Alarm Service
import { scheduleAlarm, cancelAllAlarms as nativeCancelAllAlarms } from "./NativeAlarmService";

// AlarmKit
import { alarmKit, type AlarmConfig } from "./AlarmKit";

// Sounds
import { getIOSSoundName } from "./sounds";

// Location
import locationStore from "@/stores/location";
import type { AlarmSettings } from "@/types/alarm";
import { dateToInt, timeZonedNow } from "@/utils/date";

type ScheduleResult = {
  success: boolean;
  alarmId: string | null;
  scheduledTime: Date | null;
  error?: string;
};

// ==========================================
// ALARM SCHEDULER SERVICE
// ==========================================

class AlarmSchedulerService {
  private static instance: AlarmSchedulerService;

  private constructor() {}

  static getInstance(): AlarmSchedulerService {
    if (!AlarmSchedulerService.instance) {
      AlarmSchedulerService.instance = new AlarmSchedulerService();
    }
    return AlarmSchedulerService.instance;
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  async initialize(): Promise<boolean> {
    console.log("[AlarmScheduler] Initializing...");

    if (Platform.OS === "android") {
      // Android uses native AlarmModule - no initialization needed
      return true;
    }

    if (Platform.OS === "ios") {
      const supported = await alarmKit.isSupported();
      if (supported) {
        const { status } = await alarmKit.requestAuthorization();
        console.log("[AlarmScheduler] AlarmKit authorization:", status);
        return status === "authorized";
      }
      console.log("[AlarmScheduler] AlarmKit not supported on this iOS version");
      return false;
    }

    return false;
  }

  // ==========================================
  // FAJR ALARM SCHEDULING
  // ==========================================

  async scheduleFajrAlarm(settings: AlarmSettings): Promise<ScheduleResult> {
    if (!settings.enabled) {
      console.log("[AlarmScheduler] Fajr alarm is disabled");
      return { success: false, alarmId: null, scheduledTime: null };
    }

    const timezone = locationStore.getState().locationDetails.timezone;
    const alarmTime = await this.calculateFajrAlarmTime(settings, timezone);

    if (!alarmTime) {
      return {
        success: false,
        alarmId: null,
        scheduledTime: null,
        error: "Could not calculate Fajr alarm time",
      };
    }

    console.log(`[AlarmScheduler] Scheduling Fajr alarm for ${alarmTime.toISOString()}`);

    if (Platform.OS === "android") {
      return this.scheduleFajrAndroid(alarmTime, settings);
    }

    if (Platform.OS === "ios") {
      return this.scheduleFajrIOS(alarmTime, settings);
    }

    return { success: false, alarmId: null, scheduledTime: null, error: "Unsupported platform" };
  }

  private async calculateFajrAlarmTime(
    settings: AlarmSettings,
    timezone: string
  ): Promise<Date | null> {
    const now = timeZonedNow(timezone);

    // Fixed time mode
    if (settings.timeMode === "fixed" && settings.fixedHour !== undefined) {
      let alarmTime = setHours(now, settings.fixedHour);
      alarmTime = setMinutes(alarmTime, settings.fixedMinute ?? 0);
      alarmTime = setSeconds(alarmTime, 0);
      alarmTime = setMilliseconds(alarmTime, 0);

      // If time has passed today, schedule for tomorrow
      if (isBefore(alarmTime, now)) {
        alarmTime = addDays(alarmTime, 1);
      }

      // Convert from zoned time to UTC for scheduling
      return fromZonedTime(alarmTime, timezone);
    }

    // Dynamic time mode - get from prayer times DB
    const todayInt = dateToInt(now);
    let prayerTimes = await PrayerTimesDB.getPrayerTimesByDate(todayInt);

    if (!prayerTimes?.timings.fajr) {
      console.warn("[AlarmScheduler] No Fajr time found for today");
      return null;
    }

    // Parse Fajr time (format: "05:30")
    let alarmTime = this.parsePrayerTime(prayerTimes.timings.fajr, now, timezone);

    // Apply offset
    alarmTime = new Date(alarmTime.getTime() + settings.offsetMinutes * 60 * 1000);

    // If time has passed, get tomorrow's Fajr
    if (isBefore(alarmTime, new Date())) {
      const tomorrow = addDays(now, 1);
      const tomorrowInt = dateToInt(tomorrow);
      prayerTimes = await PrayerTimesDB.getPrayerTimesByDate(tomorrowInt);

      if (!prayerTimes?.timings.fajr) {
        console.warn("[AlarmScheduler] No Fajr time found for tomorrow");
        return null;
      }

      alarmTime = this.parsePrayerTime(prayerTimes.timings.fajr, tomorrow, timezone);
      alarmTime = new Date(alarmTime.getTime() + settings.offsetMinutes * 60 * 1000);
    }

    return alarmTime;
  }

  private async scheduleFajrAndroid(
    alarmTime: Date,
    settings: AlarmSettings
  ): Promise<ScheduleResult> {
    const alarmId = `fajr-alarm-${alarmTime.getTime()}`;

    const result = await scheduleAlarm({
      id: alarmId,
      type: "fajr",
      scheduledTime: alarmTime,
      title: i18n.t("alarm.fajrPrayer"),
      body: i18n.t("alarm.prayerBetterThanSleep"),
      subtitle: i18n.t("alarm.prayerBetterThanSleep"),
      settings,
    });

    return {
      success: !!result,
      alarmId: result,
      scheduledTime: alarmTime,
    };
  }

  private async scheduleFajrIOS(alarmTime: Date, settings: AlarmSettings): Promise<ScheduleResult> {
    const isSupported = await alarmKit.isSupported();
    if (!isSupported) {
      return {
        success: false,
        alarmId: null,
        scheduledTime: null,
        error: "AlarmKit not supported (requires iOS 26+)",
      };
    }

    const config: AlarmConfig = {
      title: i18n.t("alarm.fajrPrayer"),
      timestamp: alarmTime.getTime(),
      snoozeMinutes: settings.snoozeEnabled ? settings.snoozeDurationMinutes : undefined,
      soundName: getIOSSoundName(settings.sound),
      tintColor: "#4CAF50",
      stopButtonText: i18n.t("alarm.prayerBetterThanSleep"),
    };

    try {
      const result = await alarmKit.scheduleAlarm(config);
      return {
        success: result.success,
        alarmId: result.alarmId,
        scheduledTime: alarmTime,
      };
    } catch (error) {
      return {
        success: false,
        alarmId: null,
        scheduledTime: null,
        error: error instanceof Error ? error.message : "Failed to schedule iOS alarm",
      };
    }
  }

  // ==========================================
  // JUMMAH ALARM SCHEDULING
  // ==========================================

  async scheduleJummahAlarm(settings: AlarmSettings): Promise<ScheduleResult> {
    if (!settings.enabled) {
      console.log("[AlarmScheduler] Jummah alarm is disabled");
      return { success: false, alarmId: null, scheduledTime: null };
    }

    const timezone = locationStore.getState().locationDetails.timezone;
    const alarmTime = await this.calculateJummahAlarmTime(settings, timezone);

    if (!alarmTime) {
      return {
        success: false,
        alarmId: null,
        scheduledTime: null,
        error: "Could not calculate Jummah alarm time",
      };
    }

    console.log(`[AlarmScheduler] Scheduling Jummah alarm for ${alarmTime.toISOString()}`);

    if (Platform.OS === "android") {
      return this.scheduleJummahAndroid(alarmTime, settings);
    }

    if (Platform.OS === "ios") {
      return this.scheduleJummahIOS(alarmTime, settings);
    }

    return { success: false, alarmId: null, scheduledTime: null, error: "Unsupported platform" };
  }

  private async calculateJummahAlarmTime(
    settings: AlarmSettings,
    timezone: string
  ): Promise<Date | null> {
    const now = timeZonedNow(timezone);
    const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday

    // Calculate days until next Friday
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;

    // Fixed time mode
    if (settings.timeMode === "fixed" && settings.fixedHour !== undefined) {
      let targetDay = now;

      if (daysUntilFriday === 0) {
        // It's Friday - check if time has passed
        let alarmTime = setHours(now, settings.fixedHour);
        alarmTime = setMinutes(alarmTime, settings.fixedMinute ?? 0);
        alarmTime = setSeconds(alarmTime, 0);
        alarmTime = setMilliseconds(alarmTime, 0);

        if (isBefore(alarmTime, now)) {
          // Time passed, schedule next Friday
          daysUntilFriday = 7;
          targetDay = addDays(now, 7);
        } else {
          return fromZonedTime(alarmTime, timezone);
        }
      } else {
        targetDay = addDays(now, daysUntilFriday);
      }

      let alarmTime = setHours(targetDay, settings.fixedHour);
      alarmTime = setMinutes(alarmTime, settings.fixedMinute ?? 0);
      alarmTime = setSeconds(alarmTime, 0);
      alarmTime = setMilliseconds(alarmTime, 0);

      return fromZonedTime(alarmTime, timezone);
    }

    // Dynamic time mode - get Dhuhr time (Jummah is at Dhuhr)
    let targetFriday = addDays(now, daysUntilFriday);

    // If today is Friday, check if Dhuhr has passed
    if (daysUntilFriday === 0) {
      const todayInt = dateToInt(now);
      const todayPrayers = await PrayerTimesDB.getPrayerTimesByDate(todayInt);

      if (todayPrayers?.timings.dhuhr) {
        let alarmTime = this.parsePrayerTime(todayPrayers.timings.dhuhr, now, timezone);
        alarmTime = new Date(alarmTime.getTime() + settings.offsetMinutes * 60 * 1000);

        if (isBefore(alarmTime, new Date())) {
          // Dhuhr passed, schedule next Friday
          targetFriday = addDays(now, 7);
        } else {
          return alarmTime;
        }
      }
    }

    // Get prayer times for target Friday
    const fridayInt = dateToInt(targetFriday);
    const fridayPrayers = await PrayerTimesDB.getPrayerTimesByDate(fridayInt);

    if (!fridayPrayers?.timings.dhuhr) {
      console.warn("[AlarmScheduler] No Dhuhr time found for Friday:", fridayInt);
      return null;
    }

    let alarmTime = this.parsePrayerTime(fridayPrayers.timings.dhuhr, targetFriday, timezone);
    alarmTime = new Date(alarmTime.getTime() + settings.offsetMinutes * 60 * 1000);

    return alarmTime;
  }

  private async scheduleJummahAndroid(
    alarmTime: Date,
    settings: AlarmSettings
  ): Promise<ScheduleResult> {
    const alarmId = `jummah-alarm-${alarmTime.getTime()}`;

    const result = await scheduleAlarm({
      id: alarmId,
      type: "jummah",
      scheduledTime: alarmTime,
      title: i18n.t("alarm.jummahPrayer"),
      body: i18n.t("alarm.jummahReminder"),
      settings,
    });

    return {
      success: !!result,
      alarmId: result,
      scheduledTime: alarmTime,
    };
  }

  private async scheduleJummahIOS(
    alarmTime: Date,
    settings: AlarmSettings
  ): Promise<ScheduleResult> {
    const isSupported = await alarmKit.isSupported();
    if (!isSupported) {
      return {
        success: false,
        alarmId: null,
        scheduledTime: null,
        error: "AlarmKit not supported (requires iOS 26+)",
      };
    }

    const config: AlarmConfig = {
      title: i18n.t("alarm.jummahPrayer"),
      timestamp: alarmTime.getTime(),
      weekdays: [5], // Friday only
      snoozeMinutes: settings.snoozeEnabled ? settings.snoozeDurationMinutes : undefined,
      soundName: getIOSSoundName(settings.sound),
      tintColor: "#4CAF50",
    };

    try {
      const result = await alarmKit.scheduleAlarm(config);
      return {
        success: result.success,
        alarmId: result.alarmId,
        scheduledTime: alarmTime,
      };
    } catch (error) {
      return {
        success: false,
        alarmId: null,
        scheduledTime: null,
        error: error instanceof Error ? error.message : "Failed to schedule iOS alarm",
      };
    }
  }

  async cancelAllAlarms(): Promise<void> {
    console.log("[AlarmScheduler] Cancelling all alarms");

    if (Platform.OS === "android") {
      await nativeCancelAllAlarms();
    }

    if (Platform.OS === "ios") {
      const alarms = await alarmKit.getAllAlarms();
      for (const alarm of alarms) {
        await alarmKit.cancelAlarm(alarm.id);
      }
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private parsePrayerTime(timeString: string, dateRef: Date, timezone: string): Date {
    // Prayer time format: "05:30" or "05:30 (PKT)"
    const cleanTime = timeString.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const [hourStr, minuteStr] = cleanTime.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    let prayerDate = new Date(dateRef);
    prayerDate = setHours(prayerDate, hour);
    prayerDate = setMinutes(prayerDate, minute);
    prayerDate = setSeconds(prayerDate, 0);
    prayerDate = setMilliseconds(prayerDate, 0);

    // Convert from zoned time to UTC
    return fromZonedTime(prayerDate, timezone);
  }
}

export const alarmScheduler = AlarmSchedulerService.getInstance();
