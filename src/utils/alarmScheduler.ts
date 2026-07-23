import i18next from "@/localization/i18n";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";
import { alarmLog } from "@/utils/alarmReport";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { generateDeterministicUUID, getAlarmKey } from "@/utils/alarmId";
import { pickNextTrigger } from "@/utils/alarmTrigger";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";
import { waitForHydration } from "@/utils/storeHydration";

const ALARM_HYDRATION_TIMEOUT_MS = 5000;

// Alarm stores rehydrate asynchronously; startup readers (scheduling, native
// queue drain) must await this or they read defaults and lose recurrences.
export const waitForAlarmStores = async (): Promise<void> => {
  const onTimeout = () =>
    alarmLog.w(
      "Scheduler",
      "waitForAlarmStores: hydration timed out — proceeding with current state"
    );

  await Promise.all([
    waitForHydration(useAlarmStore.persist, {
      timeoutMs: ALARM_HYDRATION_TIMEOUT_MS,
      onTimeout,
    }),
    waitForHydration(useAlarmSettingsStore.persist, {
      timeoutMs: ALARM_HYDRATION_TIMEOUT_MS,
      onTimeout,
    }),
  ]);
};

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

function getFridayDhuhrCandidates(): Date[] {
  const { todayTimings, tomorrowTimings, twoWeeksTimings } = usePrayerTimesStore.getState();

  return [todayTimings, tomorrowTimings, ...(twoWeeksTimings || [])]
    .filter((timing): timing is NonNullable<typeof timing> => Boolean(timing))
    .map((timing) => ({ dhuhrDate: new Date(timing.timings.dhuhr), timeZone: timing.timezone }))
    .filter(({ dhuhrDate, timeZone }) => isFridayInTimeZone(dhuhrDate, timeZone))
    .map(({ dhuhrDate }) => dhuhrDate);
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

  // Select by *trigger* time (prayer minus offset), not prayer time: right after a
  // before-prayer alarm fires, today's prayer is still future but its trigger is past,
  // and the next occurrence must come from tomorrow's data.
  const { todayTimings, tomorrowTimings } = usePrayerTimesStore.getState();
  const timing = settingsType ? alarmSettings[settingsType]?.timing : null;
  const next = pickNextTrigger(
    [todayTimings?.timings[prayerName], tomorrowTimings?.timings[prayerName]].map((iso) =>
      iso ? new Date(iso) : null
    ),
    timing
  );

  if (!next) {
    alarmLog.w(
      "Scheduler",
      `${alarmType}: no future trigger for ${prayerName} — alarm not scheduled`
    );
    return null;
  }
  const { triggerDate } = next;

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

  // Friday always uses beforePrayerTime; selecting by trigger lets a passed offset
  // roll over to the next Friday in the two-week window.
  const next = pickNextTrigger(getFridayDhuhrCandidates(), settings.timing);

  if (!next) {
    alarmLog.w("Scheduler", "jummah: no future Friday trigger — alarm not scheduled");
    return null;
  }
  const { triggerDate } = next;

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
