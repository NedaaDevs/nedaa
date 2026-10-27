import { ALARM_OUTCOME, type AlarmOutcome } from "expo-alarm";
import i18next from "@/localization/i18n";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmStreakStore } from "@/stores/alarmStreak";
import { alarmLog } from "@/utils/alarmReport";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { generateDeterministicUUID, getAlarmKey } from "@/utils/alarmId";
import { applyTimingOffset, pickNextTrigger } from "@/utils/alarmTrigger";
import type { TimingConfig } from "@/types/alarm";
import { FIRED_LEDGER } from "@/constants/FiredPrayerGuard";
import { readLedger, recordBooked } from "@/services/firedPrayerLedger";
import { hasFired } from "@/utils/firedPrayerGuard";
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
  // Later days too: an offset can put tomorrow's trigger before midnight.
  const { todayTimings, tomorrowTimings, twoWeeksTimings } = usePrayerTimesStore.getState();
  const timing = settingsType ? alarmSettings[settingsType]?.timing : null;
  const candidates = [todayTimings, tomorrowTimings, ...(twoWeeksTimings || [])].map((day) => {
    const iso = day?.timings[prayerName];
    return iso ? new Date(iso) : null;
  });

  return armNextOccurrences(candidates, timing, alarmType, i18next.t(`prayerTimes.${prayerName}`));
}

// Drops each future candidate whose occurrence already rang under the
// schedule this one replaces.
const withoutRungOccurrences = (
  candidates: (Date | null)[],
  timing: TimingConfig | null | undefined,
  alarmType: ScheduledAlarmType,
  now: number
): (Date | null)[] => {
  const armedBefore = readLedger(FIRED_LEDGER.ALARMS, now);
  // By instant: today and tomorrow appear twice among the candidates.
  const rung = new Set<number>();
  const kept = candidates.map((prayerDate) => {
    if (!prayerDate) return null;
    const trigger = applyTimingOffset(prayerDate, timing).getTime();
    if (trigger <= now || !hasFired(armedBefore, alarmType, trigger, now)) return prayerDate;
    rung.add(trigger);
    return null;
  });
  if (rung.size > 0) {
    alarmLog.i(
      "Scheduler",
      `${alarmType}: ${rung.size} occurrence(s) already rang — not armed again`
    );
  }
  return kept;
};

// Arms the next occurrence and the one after it. The second rings even when the
// first one's completion never reaches JS, which is what schedules the next.
async function armNextOccurrences(
  candidates: (Date | null)[],
  timing: TimingConfig | null | undefined,
  alarmType: ScheduledAlarmType,
  title: string
): Promise<string | null> {
  const now = Date.now();
  const unrung = withoutRungOccurrences(candidates, timing, alarmType, now);
  const next = pickNextTrigger(unrung, timing, now);
  if (!next) {
    alarmLog.w("Scheduler", `${alarmType}: no future trigger — alarm not scheduled`);
    return null;
  }
  const following = pickNextTrigger(unrung, timing, next.triggerDate.getTime());

  // The alarm ledger's one writer: previews, test alarms and snoozes book
  // through the store and never count as a rung occurrence.
  const arm = async (triggerDate: Date): Promise<string | null> => {
    const id = generateDeterministicUUID(getAlarmKey(alarmType, triggerDate));
    const success = await useAlarmStore
      .getState()
      .scheduleAlarm({ id, triggerDate, title, alarmType });
    if (!success) return null;
    recordBooked(FIRED_LEDGER.ALARMS, [{ key: alarmType, at: triggerDate.getTime() }], Date.now());
    return id;
  };

  const firstId = await arm(next.triggerDate);
  if (following) await arm(following.triggerDate);
  return firstId;
}

export async function scheduleFajrAlarm(): Promise<string | null> {
  const settings = useAlarmSettingsStore.getState().fajr;
  if (!settings.enabled) return null;

  return schedulePrayerAlarm("fajr", ScheduledAlarmType.FAJR);
}

export async function scheduleFridayAlarm(): Promise<string | null> {
  const settings = useAlarmSettingsStore.getState().friday;
  if (!settings.enabled) return null;

  // Friday always uses beforePrayerTime; selecting by trigger lets a passed offset
  // roll over to the next Friday in the two-week window.
  return armNextOccurrences(
    getFridayDhuhrCandidates(),
    settings.timing,
    ScheduledAlarmType.JUMMAH,
    i18next.t("prayerTimes.jumuah")
  );
}

// One-off rehearsal alarm a few seconds out, routed through the normal fire path
// for the given type so it reads the user's real per-type sound/volume/challenge.
// countdown:true asks iOS to show a live pre-fire countdown (Dynamic Island / lock
// screen) so the user can close the app and watch it approach.
export const schedulePreviewAlarm = async (
  alarmType: ScheduledAlarmType,
  secondsFromNow = 30
): Promise<string | null> => {
  const alarmStore = useAlarmStore.getState();

  // Date.now() in the key keeps repeated previews from colliding on the same id.
  const id = generateDeterministicUUID(`preview_${alarmType}_${Date.now()}`);
  const triggerDate = new Date(Date.now() + secondsFromNow * 1000);
  const title = i18next.t("alarm.previewAlarmTitle");

  const success = await alarmStore.scheduleAlarm({
    id,
    triggerDate,
    title,
    alarmType,
    countdown: true,
    isPreview: true,
  });

  return success ? id : null;
};

// `queued` is the native completion record from the Android overlay: its type
// covers an alarm the store no longer holds, its outcome says whether it was solved.
export async function completeAndRescheduleAlarm(
  alarmId: string,
  queued?: { alarmType: ScheduledAlarmType; outcome: AlarmOutcome }
): Promise<void> {
  const alarmStore = useAlarmStore.getState();
  const alarm = alarmStore.scheduledAlarms[alarmId];
  const alarmType = alarm?.alarmType ?? queued?.alarmType;
  const solved = (queued?.outcome ?? ALARM_OUTCOME.SOLVED) === ALARM_OUTCOME.SOLVED;

  await alarmStore.completeAlarm(alarmId);

  // Waking for Fajr grows the streak; the store's freshness guard drops the
  // stale-alarm auto-completion path so a skipped Fajr never counts.
  if (alarm?.alarmType === ScheduledAlarmType.FAJR && !alarm.isPreview && solved) {
    useAlarmStreakStore.getState().recordFajrSuccess(alarm.triggerTime);
  }

  try {
    if (alarmType === ScheduledAlarmType.FAJR) {
      await scheduleFajrAlarm();
    } else if (alarmType === ScheduledAlarmType.JUMMAH) {
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
