import Storage from "expo-sqlite/kv-store";
import { z } from "zod";
import { FIRED_LEDGER, type FiredLedger } from "@/constants/FiredPrayerGuard";
import { AppLogger } from "@/utils/appLogger";
import { type LedgerEntry, pruneLedger } from "@/utils/firedPrayerGuard";

const ledgerSchema = z.array(z.object({ key: z.string(), at: z.number() }));

const TAG = "FiredLedger";

// "alarm" is alarmLog's domain; importing alarmReport would load its report
// section into every importer of the notification scheduler.
const LOGGERS: Record<FiredLedger, ReturnType<typeof AppLogger.create>> = {
  [FIRED_LEDGER.NOTIFICATIONS]: AppLogger.create("notifications"),
  [FIRED_LEDGER.ALARMS]: AppLogger.create("alarm"),
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const parse = (raw: string): LedgerEntry[] | null => {
  try {
    const result = ledgerSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

// null when storage throws, so a writer leaves the stored bookings alone;
// a stored value that is not a ledger reads as empty.
const load = (ledger: FiredLedger): LedgerEntry[] | null => {
  let raw: string | null;
  try {
    raw = Storage.getItemSync(ledger);
  } catch (error) {
    LOGGERS[ledger].w(TAG, `${ledger}: read failed: ${messageOf(error)}`);
    return null;
  }
  if (raw === null) return [];
  const entries = parse(raw);
  if (entries === null) {
    LOGGERS[ledger].w(TAG, `${ledger}: stored value is not a ledger`);
    return [];
  }
  return entries;
};

const rewrite = (
  ledger: FiredLedger,
  now: number,
  change: (stored: LedgerEntry[]) => LedgerEntry[]
): void => {
  const stored = load(ledger);
  if (stored === null) return;
  try {
    Storage.setItemSync(ledger, JSON.stringify(pruneLedger(change(stored), now)));
  } catch (error) {
    LOGGERS[ledger].w(TAG, `${ledger}: write failed: ${messageOf(error)}`);
  }
};

export const readLedger = (ledger: FiredLedger, now: number): LedgerEntry[] =>
  pruneLedger(load(ledger) ?? [], now);

export const recordBooked = (
  ledger: FiredLedger,
  entries: readonly LedgerEntry[],
  now: number
): void => {
  if (entries.length === 0) return;
  rewrite(ledger, now, (stored) => [...stored, ...entries]);
};

// Drops bookings due after `since`, fired or not: a kept one can block the
// moved alert, and a forgotten one only lets a second alert play.
export const forgetUnfired = (ledger: FiredLedger, since: number): void =>
  rewrite(ledger, since, (stored) => stored.filter((entry) => entry.at <= since));

export const forgetBooking = (ledger: FiredLedger, booking: LedgerEntry, since: number): void => {
  if (booking.at <= since) return;
  rewrite(ledger, since, (stored) =>
    stored.filter((entry) => entry.key !== booking.key || entry.at !== booking.at)
  );
};
