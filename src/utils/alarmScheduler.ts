import * as Crypto from "expo-crypto";
import { useAlarmStore } from "@/stores/alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { alarmLogger } from "@/utils/alarmLogger";

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

export async function schedulePrayerAlarm(
  prayerName: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha",
  alarmType: "fajr" | "jummah" | "custom" = "custom"
): Promise<string | null> {
  const alarmStore = useAlarmStore.getState();

  const triggerDate = getNextPrayerDate(prayerName);
  if (!triggerDate) {
    alarmLogger.error(`No prayer time available for ${prayerName}`);
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
    alarmLogger.info(`Scheduled ${prayerName}: ${triggerDate.toISOString()}`);
    return id;
  }

  return null;
}
