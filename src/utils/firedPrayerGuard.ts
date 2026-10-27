import { SAME_OCCURRENCE_WINDOW_MS } from "@/constants/FiredPrayerGuard";
import type { NotificationType, OtherTimingId } from "@/types/notification";
import type { PrayerName } from "@/types/prayerTimes";

// One alert handed to the OS: what it is and the instant it fires.
export type LedgerEntry = { key: string; at: number };

export const notificationKey = (
  type: NotificationType,
  timingId: PrayerName | OtherTimingId
): string => `${type}:${timingId}`;

// The OS fires a booking at its instant, so a booking at or before now
// counts as fired; one under the window before nextAt is the same occurrence.
export const hasFired = (
  entries: readonly LedgerEntry[],
  key: string,
  nextAt: number,
  now: number
): boolean =>
  entries.some(
    (entry) =>
      entry.key === key &&
      entry.at <= now &&
      entry.at <= nextAt &&
      nextAt - entry.at < SAME_OCCURRENCE_WINDOW_MS
  );

// An entry a full window old can match no alert booked from now on.
export const pruneLedger = (entries: readonly LedgerEntry[], now: number): LedgerEntry[] =>
  entries.filter((entry) => entry.at > now - SAME_OCCURRENCE_WINDOW_MS);
