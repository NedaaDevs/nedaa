import * as Crypto from "expo-crypto";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

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
    return new Date(tomorrowTimings.timings[prayerName]);
  }

  return null;
}

export function getNextFridayDhuhr(): Date | null {
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

export async function schedulePrayerAlarm(
  prayerName: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha",
  alarmType: "fajr" | "jummah" | "custom" = "custom"
): Promise<string | null> {
  const alarmStore = useAlarmStore.getState();
  const alarmSettings = useAlarmSettingsStore.getState();

  const settingsType = alarmType === "jummah" ? "friday" : alarmType === "fajr" ? "fajr" : null;
  if (settingsType && !alarmSettings[settingsType].enabled) {
    return null;
  }

  const triggerDate = getNextPrayerDate(prayerName);
  if (!triggerDate) {
    return null;
  }

  const id = Crypto.randomUUID();
  const title = `${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)} Prayer`;

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

  return schedulePrayerAlarm("fajr", "fajr");
}

export async function scheduleFridayAlarm(): Promise<string | null> {
  const settings = useAlarmSettingsStore.getState().friday;
  if (!settings.enabled) return null;

  const alarmStore = useAlarmStore.getState();
  const triggerDate = getNextFridayDhuhr();

  if (!triggerDate) return null;

  const id = Crypto.randomUUID();
  const title = "Jumu'ah Prayer";

  const success = await alarmStore.scheduleAlarm({
    id,
    triggerDate,
    title,
    alarmType: "jummah",
  });

  return success ? id : null;
}
