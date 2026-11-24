import {
  RINGING_TIME,
  SNOOZE_PLACE,
  type RingingTime,
  type SnoozePlace,
} from "@/constants/AlarmRinging";
import { PRAYER_ID } from "@/constants/Prayer";
import { ScheduledAlarmType } from "@/enums/alarm";
import type { PrayerName } from "@/types/prayerTimes";
import { isScheduledAlarmType } from "@/utils/alarmTypes";

// The ringing screen's rules; RingingScreen.kt holds the header's and the
// snooze's twins, pinned by ringing-header.tsv and snooze-place.tsv.

/** An alarm's prayer: the name it shows and the timing it reads. */
export type AlarmPrayer = Readonly<{ nameKey: string; timing: PrayerName }>;

// Jumu'ah is the Friday Dhuhr occurrence; a custom alarm has no prayer.
const PRAYER_BY_ALARM: Record<ScheduledAlarmType.FAJR | ScheduledAlarmType.JUMMAH, AlarmPrayer> = {
  [ScheduledAlarmType.FAJR]: { nameKey: "prayerTimes.fajr", timing: PRAYER_ID.FAJR },
  [ScheduledAlarmType.JUMMAH]: { nameKey: "prayerTimes.jumuah", timing: PRAYER_ID.DHUHR },
};

const ALARM_NAME_KEY: Record<ScheduledAlarmType, string> = {
  [ScheduledAlarmType.FAJR]: "alarm.types.fajr",
  [ScheduledAlarmType.JUMMAH]: "alarm.types.friday",
  [ScheduledAlarmType.CUSTOM]: "alarm.types.custom",
};

export type RingingHeader = Readonly<{
  prayerKey: string | null;
  alarmKey: string;
  nameKey: string;
  time: RingingTime;
  headingKey: string;
  announcementKey: string;
}>;

/** A link can carry a type no alarm has; it rings as a custom alarm. */
export const ringingTypeOf = (raw: string): ScheduledAlarmType =>
  isScheduledAlarmType(raw) ? raw : ScheduledAlarmType.CUSTOM;

export const alarmPrayerOf = (type: ScheduledAlarmType): AlarmPrayer | null =>
  type === ScheduledAlarmType.CUSTOM ? null : PRAYER_BY_ALARM[type];

export const alarmNameKeyOf = (type: ScheduledAlarmType): string => ALARM_NAME_KEY[type];

/** The prayer's time heads the screen; with none stored, the clock does. */
export const ringingHeader = (type: ScheduledAlarmType, hasMoment: boolean): RingingHeader => {
  const prayerKey = alarmPrayerOf(type)?.nameKey ?? null;
  const time = hasMoment ? RINGING_TIME.PRAYER : RINGING_TIME.CLOCK;
  return {
    prayerKey,
    alarmKey: alarmNameKeyOf(type),
    nameKey: prayerKey ?? alarmNameKeyOf(type),
    time,
    // A prayer alarm without its stored time shows the clock, said as the time now.
    headingKey:
      prayerKey && time === RINGING_TIME.CLOCK ? "a11y.alarm.currentTime" : "a11y.alarm.ringingAt",
    announcementKey: prayerKey ? "a11y.alarm.ringingAnnouncement" : "a11y.alarm.ringingCustom",
  };
};

/** An alarm can ring before its prayer, so the line reads from the solve. */
export const solvedLineKey = (
  type: ScheduledAlarmType,
  momentAt: number | null,
  solvedAt: number
): string | null => {
  if (!alarmPrayerOf(type) || momentAt === null) return null;
  return momentAt <= solvedAt ? "alarm.solved.began" : "alarm.solved.begins";
};

export type SnoozeUse = Readonly<{ enabled: boolean; count: number; max: number }>;

/** A snooze is left; a running quiet holds it back apart from this. */
export const snoozeOpen = ({ enabled, count, max }: SnoozeUse): boolean => enabled && count < max;

export const snoozeLeft = ({ enabled, count, max }: SnoozeUse): number =>
  enabled ? Math.max(0, max - count) : 0;

/** Snooze, or one line in its place, so the main button keeps its place. */
export const snoozePlace = (open: boolean, enabled: boolean): SnoozePlace =>
  open ? SNOOZE_PLACE.BUTTON : enabled ? SNOOZE_PLACE.USED_UP : SNOOZE_PLACE.OFF;
