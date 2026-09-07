import { addDays, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { Directory, File, Paths } from "expo-file-system";

import { dateToInt } from "@/utils/date";

import type { AthkarWidgetSnapshotData } from "@/services/athkar-db";
import type { WidgetImportantDay } from "@/services/widgetPayloads";
import type { DayPrayerTimes, OtherTimings, PrayerTimings } from "@/types/prayerTimes";

export const WIDGET_SNAPSHOT_VERSION = 1 as const;
export const SNAPSHOT_DIR = "widgets";
export const SNAPSHOT_FILE = "snapshot.json";
const SNAPSHOT_TMP = "snapshot.json.tmp";

export type SnapshotDay = { date: number; timings: PrayerTimings; otherTimings: OtherTimings };

// The document the Android widgets read. Every today-keyed group carries the YYYYMMDD
// it was computed for, in `config.timezone`, so a widget waking after midnight can tell
// the values are yesterday's.
export type WidgetSnapshot = {
  version: typeof WIDGET_SNAPSHOT_VERSION;
  writtenAt: number;
  config: { useWesternNumerals: boolean; timezone: string; hijriDaysOffset: number };
  prayerTimes: { timezone: string; days: SnapshotDay[] };
  hijriToday: { date: number; hijriLabel: string };
  importantDays: WidgetImportantDay[];
  athkar: { date: number } & AthkarWidgetSnapshotData;
  qada: { date: number; totalMissed: number; totalCompleted: number; completedToday: number };
};

export type WidgetSnapshotInputs = {
  nowMs: number;
  timezone: string;
  hijriDaysOffset: number;
  useWesternNumerals: boolean;
  prayerDays: DayPrayerTimes[];
  hijriLabel: string;
  importantDays: WidgetImportantDay[];
  athkar: AthkarWidgetSnapshotData;
  qadaTotals: { totalMissed: number; totalCompleted: number };
  qadaCompletedToday: number;
};

// Three days: today, and enough to survive a full day with no app run plus one failed
// background refresh. Days absent from the database are left out, not fabricated.
export const buildWidgetSnapshot = (input: WidgetSnapshotInputs): WidgetSnapshot => {
  const zonedNow = toZonedTime(input.nowMs, input.timezone);
  const today = dateToInt(zonedNow);
  const wanted = [today, dateToInt(addDays(zonedNow, 1)), dateToInt(addDays(zonedNow, 2))];
  const byDate = new Map(input.prayerDays.map((d) => [d.date, d]));
  return {
    version: WIDGET_SNAPSHOT_VERSION,
    writtenAt: input.nowMs,
    config: {
      useWesternNumerals: input.useWesternNumerals,
      timezone: input.timezone,
      hijriDaysOffset: input.hijriDaysOffset,
    },
    prayerTimes: {
      timezone: input.timezone,
      days: wanted.flatMap((date) => {
        const d = byDate.get(date);
        return d ? [{ date, timings: d.timings, otherTimings: d.otherTimings }] : [];
      }),
    },
    hijriToday: { date: today, hijriLabel: input.hijriLabel },
    importantDays: input.importantDays,
    athkar: { date: today, ...input.athkar },
    qada: { date: today, ...input.qadaTotals, completedToday: input.qadaCompletedToday },
  };
};

// The local calendar day in `timezone`, as the UTC instants `updated_at` is compared to.
export const todayUtcBounds = (
  nowMs: number,
  timezone: string
): { startIso: string; endIso: string } => {
  const start = startOfDay(toZonedTime(nowMs, timezone));
  return {
    startIso: fromZonedTime(start, timezone).toISOString(),
    endIso: fromZonedTime(addDays(start, 1), timezone).toISOString(),
  };
};

// Written in full to a temp file first, so Kotlin can never read a torn document.
// `move()` refuses an existing destination, so the target is deleted for the duration of
// the rename; a reader in that window sees no file and takes the same path as a first
// launch. Awaited because the native move lands on a background dispatcher.
export const writeSnapshotFile = async (snapshot: WidgetSnapshot): Promise<void> => {
  const dir = new Directory(Paths.document, SNAPSHOT_DIR);
  if (!dir.exists) dir.create();
  const tmp = new File(dir, SNAPSHOT_TMP);
  if (tmp.exists) tmp.delete();
  tmp.create();
  tmp.write(JSON.stringify(snapshot));
  const target = new File(dir, SNAPSHOT_FILE);
  if (target.exists) target.delete();
  await tmp.move(target);
};
