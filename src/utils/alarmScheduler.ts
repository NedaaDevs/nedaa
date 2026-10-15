import { ALARM_OUTCOME, type AlarmOutcome } from "expo-alarm";
import i18next from "@/localization/i18n";
import { ScheduledAlarmType } from "@/enums/alarm";
import { type ScheduledAlarm, useAlarmStore } from "@/stores/alarm";
import { useAlarmStreakStore } from "@/stores/alarmStreak";
import { alarmLog } from "@/utils/alarmReport";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { generateDeterministicUUID, getAlarmKey, getLegacyAlarmKey } from "@/utils/alarmId";
import { applyTimingOffset, pickNextTrigger } from "@/utils/alarmTrigger";
import { toScheduledAlarmType, toSettingsAlarmType } from "@/utils/alarmTypes";
import type { TimingConfig } from "@/types/alarm";
import { FIRED_LEDGER } from "@/constants/FiredPrayerGuard";
import { SAME_OCCURRENCE_WINDOW_MS } from "@/constants/PrayerOccurrence";
import { readLedger, recordBooked } from "@/services/firedPrayerLedger";
import { hasFired } from "@/utils/firedPrayerGuard";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";
import { waitForHydration } from "@/utils/storeHydration";
import { readTimesPlace } from "@/utils/timesPlace";
import { ALARM_DEFAULTS, ALARM_HYDRATION_TIMEOUT_MS, ALARM_TYPE } from "@/constants/Alarm";
import { TIMES_PLACE, type TimesPlace } from "@/constants/Location";
import { PRAYER_ID, type PrayerId } from "@/constants/Prayer";

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

export function getNextPrayerDate(prayerName: PrayerId): Date | null {
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
  prayerName: PrayerId,
  alarmType: ScheduledAlarmType = ScheduledAlarmType.CUSTOM,
  after = 0
): Promise<string | null> {
  // Select by *trigger* time (prayer minus offset), not prayer time: right after a
  // before-prayer alarm fires, today's prayer is still future but its trigger is past,
  // and the next occurrence must come from tomorrow's data.
  // Later days too: an offset can put tomorrow's trigger before midnight.
  const readCandidates = (): (Date | null)[] => {
    const { todayTimings, tomorrowTimings, twoWeeksTimings } = usePrayerTimesStore.getState();
    return [todayTimings, tomorrowTimings, ...(twoWeeksTimings || [])].map((day) => {
      const iso = day?.timings[prayerName];
      return iso ? new Date(iso) : null;
    });
  };

  return armNextOccurrences(
    alarmType,
    i18next.t(`prayerTimes.${prayerName}`),
    readCandidates,
    after
  );
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

const occurrenceId = (alarmType: ScheduledAlarmType, at: number): string =>
  generateDeterministicUUID(getAlarmKey(alarmType, new Date(at)));

// TODO(alarm-id-migration): a 2.x id names an occurrence by its UTC date.
const isLegacyOccurrence = (alarm: ScheduledAlarm): boolean =>
  alarm.alarmId ===
  generateDeterministicUUID(getLegacyAlarmKey(alarm.alarmType, new Date(alarm.triggerTime)));

// Snoozes, rehearsals and test alarms carry ids no trigger instant produces.
const isOccurrence = (alarm: ScheduledAlarm): boolean =>
  alarm.alarmId === occurrenceId(alarm.alarmType, alarm.triggerTime) || isLegacyOccurrence(alarm);

let planTail: Promise<unknown> = Promise.resolve();

// One plan at a time: two plans of different times cancel each other.
const serially = <T>(task: () => Promise<T>): Promise<T> => {
  const run = planTail.then(task);
  planTail = run.catch(() => undefined);
  return run;
};

type ArmedOccurrence = { id: string; at: number };

// Future occurrences within the window of an alarm this plan armed. Only a
// successful arm replaces one, so a failed arm never removes a ring.
const replacedOccurrenceIds = (
  alarmType: ScheduledAlarmType,
  armed: readonly ArmedOccurrence[],
  now: number
): string[] =>
  Object.values(useAlarmStore.getState().scheduledAlarms)
    .filter(
      (alarm) =>
        alarm.alarmType === alarmType &&
        alarm.triggerTime > now &&
        isOccurrence(alarm) &&
        !armed.some(({ id }) => id === alarm.alarmId) &&
        armed.some(({ at }) => Math.abs(at - alarm.triggerTime) < SAME_OCCURRENCE_WINDOW_MS)
    )
    .map((alarm) => alarm.alarmId);

// Arms the next occurrence and the one after it. The second rings even when the
// first one's completion never reaches JS, which is what schedules the next.
const armNextOccurrences = (
  alarmType: ScheduledAlarmType,
  title: string,
  readCandidates: () => (Date | null)[],
  after: number
): Promise<string | null> =>
  serially(async () => {
    const settingsType = toSettingsAlarmType(alarmType);
    const settings = settingsType ? useAlarmSettingsStore.getState()[settingsType] : null;
    if (settings && !settings.enabled) return null;
    const place = await readTimesPlace();
    // Only a verified place's times ring at the right hour.
    if (place !== TIMES_PLACE.VERIFIED) {
      alarmLog.w("Scheduler", `${alarmType}: place ${place}, not verified — alarm not scheduled`);
      return null;
    }
    const timing = settings?.timing;

    // A solved trigger can still be ahead of now; arm only what follows it.
    const from = Math.max(Date.now(), after);
    // Read after the place check, which waits for the stored times to load.
    const unrung = withoutRungOccurrences(readCandidates(), timing, alarmType, from);
    const next = pickNextTrigger(unrung, timing, from);
    if (!next) {
      alarmLog.w("Scheduler", `${alarmType}: no future trigger — alarm not scheduled`);
      return null;
    }
    const following = pickNextTrigger(unrung, timing, next.triggerDate.getTime());

    const armed: ArmedOccurrence[] = [];
    for (const { triggerDate } of following ? [next, following] : [next]) {
      const id = occurrenceId(alarmType, triggerDate.getTime());
      const success = await useAlarmStore
        .getState()
        .scheduleAlarm({ id, triggerDate, title, alarmType });
      if (success) armed.push({ id, at: triggerDate.getTime() });
    }

    await useAlarmStore
      .getState()
      .cancelAlarms(replacedOccurrenceIds(alarmType, armed, Date.now()));
    // After the cancel, which forgets a cancelled 2.x alarm's instant; only
    // what is still stored, as a cancel by type can run while this plan waits.
    const { scheduledAlarms } = useAlarmStore.getState();
    recordBooked(
      FIRED_LEDGER.ALARMS,
      armed.filter(({ id }) => id in scheduledAlarms).map(({ at }) => ({ key: alarmType, at })),
      Date.now()
    );
    const nextAt = next.triggerDate.getTime();
    return armed.find(({ at }) => at === nextAt)?.id ?? null;
  });

export async function scheduleFajrAlarm(after = 0): Promise<string | null> {
  const settings = useAlarmSettingsStore.getState().fajr;
  if (!settings.enabled) return null;

  return schedulePrayerAlarm(PRAYER_ID.FAJR, ScheduledAlarmType.FAJR, after);
}

export async function scheduleFridayAlarm(after = 0): Promise<string | null> {
  const settings = useAlarmSettingsStore.getState().friday;
  if (!settings.enabled) return null;

  // Friday always uses beforePrayerTime; selecting by trigger lets a passed offset
  // roll over to the next Friday in the two-week window.
  return armNextOccurrences(
    ScheduledAlarmType.JUMMAH,
    i18next.t("prayerTimes.jumuah"),
    getFridayDhuhrCandidates,
    after
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

  // The alarm screen opens up to a minute early, so a challenge can be solved
  // before its trigger. The plan skips that trigger so it does not ring again.
  const after = alarm?.triggerTime ?? 0;
  try {
    if (alarmType === ScheduledAlarmType.FAJR) {
      await scheduleFajrAlarm(after);
    } else if (alarmType === ScheduledAlarmType.JUMMAH) {
      await scheduleFridayAlarm(after);
    }
  } catch (error) {
    alarmLog.e(
      "Scheduler",
      "Failed to reschedule after completing alarm",
      error instanceof Error ? error : undefined
    );
  }
}

// TODO(alarm-id-migration): a future 2.x alarm plans its type again, and the
// plan cancels it.
const hasLegacyOccurrence = (alarmType: ScheduledAlarmType, now: number): boolean =>
  Object.values(useAlarmStore.getState().scheduledAlarms).some(
    (alarm) => alarm.alarmType === alarmType && alarm.triggerTime > now && isLegacyOccurrence(alarm)
  );

/** Cancels the prayer alarms armed for the default place's times. */
const cancelDefaultPlaceAlarms = async (place: TimesPlace): Promise<void> => {
  const alarmStore = useAlarmStore.getState();
  const armed = Object.values(ALARM_TYPE)
    .map(toScheduledAlarmType)
    .filter((type) => alarmStore.getAlarmByType(type));
  if (armed.length === 0) return;
  // Only both stores agreeing on the default place cancels.
  if (place !== TIMES_PLACE.DEFAULT) {
    alarmLog.w("Scheduler", `place ${place}, not the default one — alarms kept`);
    return;
  }
  for (const type of armed) await alarmStore.cancelAlarmsByType(type);
  alarmLog.w("Scheduler", `${armed.join(", ")}: times are for the default location — cancelled`);
};

/** Whether a real alarm of this type can still ring; a rehearsal is not one. */
const hasLiveAlarm = (type: ScheduledAlarmType): boolean => {
  const now = Date.now();
  return Object.values(useAlarmStore.getState().scheduledAlarms).some(
    (alarm) =>
      alarm.alarmType === type &&
      !alarm.isPreview &&
      now - alarm.triggerTime <= ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS
  );
};

export async function ensureAlarmsScheduled(): Promise<void> {
  const place = await readTimesPlace();
  // The switches stay on; a verified place arms them again on a later top-up.
  if (place !== TIMES_PLACE.VERIFIED) {
    await cancelDefaultPlaceAlarms(place);
    return;
  }
  const alarmSettings = useAlarmSettingsStore.getState();
  const needsPlan = (alarmType: ScheduledAlarmType): boolean =>
    !hasLiveAlarm(alarmType) || hasLegacyOccurrence(alarmType, Date.now());

  if (alarmSettings.fajr.enabled && needsPlan(ScheduledAlarmType.FAJR)) {
    await scheduleFajrAlarm();
  }
  if (alarmSettings.friday.enabled && needsPlan(ScheduledAlarmType.JUMMAH)) {
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
