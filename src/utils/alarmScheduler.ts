import i18next from "@/localization/i18n";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";
import { alarmLog } from "@/utils/alarmReport";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { generateDeterministicUUID, getAlarmKey } from "@/utils/alarmId";

export function getNextPrayerDate(
  prayerName: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha"
): Date | null {
  const { todayTimings, tomorrowTimings } = usePrayerTimesStore.getState();

  if (todayTimings?.timings[prayerName]) {
    const prayerDate = new Date(todayTimings.timings[prayerName]);
    if (prayerDate.getTime() > Date.now()) {
      return prayerDate;
    }
  }

  if (tomorrowTimings?.timings[prayerName]) {
    const prayerDate = new Date(tomorrowTimings.timings[prayerName]);
    if (prayerDate.getTime() > Date.now()) {
      return prayerDate;
    }
  }

  return null;
}

export function getNextFriday(): Date | null {
  const { todayTimings, tomorrowTimings, twoWeeksTimings } = usePrayerTimesStore.getState();

  const allTimings = [todayTimings, tomorrowTimings, ...(twoWeeksTimings || [])].filter(Boolean);

  for (const timing of allTimings) {
    if (!timing) continue;

    const dhuhrDate = new Date(timing.timings.dhuhr);
    if (dhuhrDate.getDay() === 5 && dhuhrDate.getTime() > Date.now()) {
      return dhuhrDate;
    }
  }

  return null;
}

function applyTimingOffset(
  prayerDate: Date,
  timingMode: string | undefined,
  minutesBefore: number | undefined
): Date {
  if (timingMode === "beforePrayerTime" && minutesBefore && minutesBefore > 0) {
    return new Date(prayerDate.getTime() - minutesBefore * 60 * 1000);
  }
  return prayerDate;
}

export async function schedulePrayerAlarm(
  prayerName: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha",
  alarmType: ScheduledAlarmType = ScheduledAlarmType.CUSTOM
): Promise<string | null> {
  const alarmStore = useAlarmStore.getState();
  const alarmSettings = useAlarmSettingsStore.getState();

  const settingsType =
    alarmType === ScheduledAlarmType.JUMMAH
      ? "friday"
      : alarmType === ScheduledAlarmType.FAJR
        ? "fajr"
        : null;
  if (settingsType && !alarmSettings[settingsType].enabled) {
    return null;
  }

  const prayerDate = getNextPrayerDate(prayerName);
  if (!prayerDate) {
    return null;
  }

  // Apply timing offset from settings
  const timing = settingsType ? alarmSettings[settingsType]?.timing : null;
  const triggerDate = applyTimingOffset(prayerDate, timing?.mode, timing?.minutesBefore);

  // Ensure trigger date is in the future
  if (triggerDate.getTime() <= Date.now()) {
    return null;
  }

  const id = generateDeterministicUUID(getAlarmKey(alarmType, triggerDate));
  const title = i18next.t(`prayerTimes.${prayerName}`);

  const success = await alarmStore.scheduleAlarm({
    id,
    triggerDate,
    title,
    alarmType,
  });

  if (success) {
    return id;
  }

  return null;
}

export async function scheduleFajrAlarm(): Promise<string | null> {
  const settings = useAlarmSettingsStore.getState().fajr;
  if (!settings.enabled) return null;

  return schedulePrayerAlarm("fajr", ScheduledAlarmType.FAJR);
}

export async function scheduleFridayAlarm(): Promise<string | null> {
  const settings = useAlarmSettingsStore.getState().friday;
  if (!settings.enabled) return null;

  const alarmStore = useAlarmStore.getState();
  const prayerDate = getNextFriday();

  if (!prayerDate) return null;

  // Apply timing offset from settings (Friday always uses beforePrayerTime)
  const triggerDate = applyTimingOffset(
    prayerDate,
    settings.timing?.mode,
    settings.timing?.minutesBefore
  );

  // Ensure trigger date is in the future
  if (triggerDate.getTime() <= Date.now()) {
    return null;
  }

  const id = generateDeterministicUUID(getAlarmKey(ScheduledAlarmType.JUMMAH, triggerDate));
  const title = i18next.t("prayerTimes.jumuah");

  const success = await alarmStore.scheduleAlarm({
    id,
    triggerDate,
    title,
    alarmType: ScheduledAlarmType.JUMMAH,
  });

  return success ? id : null;
}

export async function completeAndRescheduleAlarm(alarmId: string): Promise<void> {
  const alarmStore = useAlarmStore.getState();
  const alarm = alarmStore.scheduledAlarms[alarmId];

  await alarmStore.completeAlarm(alarmId);

  try {
    if (alarm?.alarmType === ScheduledAlarmType.FAJR) {
      await scheduleFajrAlarm();
    } else if (alarm?.alarmType === ScheduledAlarmType.JUMMAH) {
      await scheduleFridayAlarm();
    }
  } catch (error) {
    alarmLog.e(
      "Scheduler",
      "Failed to reschedule after completing alarm",
      error instanceof Error ? error : undefined
    );
  }
}

export async function ensureAlarmsScheduled(): Promise<void> {
  const alarmSettings = useAlarmSettingsStore.getState();
  const alarmStore = useAlarmStore.getState();

  if (alarmSettings.fajr.enabled && !alarmStore.getAlarmByType(ScheduledAlarmType.FAJR)) {
    await scheduleFajrAlarm();
  }
  if (alarmSettings.friday.enabled && !alarmStore.getAlarmByType(ScheduledAlarmType.JUMMAH)) {
    await scheduleFridayAlarm();
  }
}

export async function rescheduleAllAlarms(): Promise<void> {
  const alarmSettings = useAlarmSettingsStore.getState();
  const alarmStore = useAlarmStore.getState();

  if (alarmSettings.fajr.enabled) {
    await alarmStore.cancelAlarmsByType(ScheduledAlarmType.FAJR);
    await scheduleFajrAlarm();
  }
  if (alarmSettings.friday.enabled) {
    await alarmStore.cancelAlarmsByType(ScheduledAlarmType.JUMMAH);
    await scheduleFridayAlarm();
  }
}
