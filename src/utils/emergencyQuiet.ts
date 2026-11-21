import {
  DEFAULT_EMERGENCY_QUIET_ALLOWANCE,
  EMERGENCY_QUIET_ALLOWANCE,
  EMERGENCY_QUIET_ALLOWANCES,
  EMERGENCY_QUIET_MS,
  EMERGENCY_QUIET_OFFER,
  type EmergencyQuietAllowance,
  type EmergencyQuietOffer,
} from "@/constants/EmergencyQuiet";
import type { ScheduledAlarm } from "@/stores/alarm";
import { generateDeterministicUUID, getQuietKey } from "@/utils/alarmId";

const MONTHS_PER_YEAR = 12;

/** A Gregorian month in device local time, as year * 12 + month index. */
export type MonthKey = number;

export const monthKeyOf = (now: number): MonthKey => {
  const date = new Date(now);
  return date.getFullYear() * MONTHS_PER_YEAR + date.getMonth();
};

const firstDayOf = (month: MonthKey): Date =>
  new Date(Math.floor(month / MONTHS_PER_YEAR), month % MONTHS_PER_YEAR, 1);

/** The monthly allowance and the uses counted against it. */
export type QuietLedger = Readonly<{
  /** The allowance in effect for `month`. */
  allowance: EmergencyQuietAllowance;
  /** A higher allowance chosen, in effect from its month. */
  raise: Readonly<{ to: EmergencyQuietAllowance; from: MonthKey }> | null;
  /** The month `used` counts in; null before the first write. */
  month: MonthKey | null;
  /** Uses counted in `month`. */
  used: number;
  /** The clock at the latest write; null before the first. */
  lastWriteAt: number | null;
}>;

type Rolled = QuietLedger & { month: MonthKey };

export const NEW_QUIET_LEDGER: QuietLedger = {
  allowance: DEFAULT_EMERGENCY_QUIET_ALLOWANCE,
  raise: null,
  month: null,
  used: 0,
  lastWriteAt: null,
};

const wentBack = (ledger: QuietLedger, now: number): boolean =>
  ledger.lastWriteAt !== null && now < ledger.lastWriteAt;

// A clock set back keeps the count in the clock's month: no refill, no wait.
const rollTo = (ledger: QuietLedger, now: number): Rolled => {
  const back = wentBack(ledger, now);
  const month = back
    ? monthKeyOf(now)
    : Math.max(monthKeyOf(now), ledger.month ?? Number.NEGATIVE_INFINITY);
  const raise =
    back && ledger.raise
      ? { ...ledger.raise, from: Math.min(ledger.raise.from, month + 1) }
      : ledger.raise;
  const raised = raise !== null && month >= raise.from;
  return {
    allowance: raised ? raise.to : ledger.allowance,
    raise: raised ? null : raise,
    month,
    used: back || month === ledger.month ? ledger.used : 0,
    lastWriteAt: now,
  };
};

/** The ledger rebased on a clock set back since its last write; else as is. */
export const settleClock = (ledger: QuietLedger, now: number): QuietLedger =>
  wentBack(ledger, now) ? rollTo(ledger, now) : ledger;

export const allowanceInEffect = (ledger: QuietLedger, now: number): EmergencyQuietAllowance =>
  rollTo(ledger, now).allowance;

/** The allowance the setting shows: a pending raise, else the one in effect. */
export const chosenAllowance = (ledger: QuietLedger, now: number): EmergencyQuietAllowance => {
  const rolled = rollTo(ledger, now);
  return rolled.raise?.to ?? rolled.allowance;
};

/** The day a chosen higher allowance takes effect; null with none pending. */
export const raiseStartsOn = (ledger: QuietLedger, now: number): Date | null => {
  const { raise } = rollTo(ledger, now);
  return raise ? firstDayOf(raise.from) : null;
};

export const usesLeft = (ledger: QuietLedger, now: number): number => {
  const rolled = rollTo(ledger, now);
  return Math.max(0, rolled.allowance - rolled.used);
};

/** The ledger with one more use; null when none is left. */
export const recordUse = (ledger: QuietLedger, now: number): QuietLedger | null => {
  const rolled = rollTo(ledger, now);
  if (rolled.used >= rolled.allowance) return null;
  return { ...rolled, used: rolled.used + 1 };
};

/** A lower or equal allowance applies at once; a higher one next month. */
export const setAllowance = (
  ledger: QuietLedger,
  allowance: EmergencyQuietAllowance,
  now: number
): QuietLedger => {
  const rolled = rollTo(ledger, now);
  if (allowance <= rolled.allowance) return { ...rolled, allowance, raise: null };
  return { ...rolled, raise: { to: allowance, from: rolled.month + 1 } };
};

/** The first day of the month after the one uses count in. */
export const refillDate = (ledger: QuietLedger, now: number): Date =>
  firstDayOf(rollTo(ledger, now).month + 1);

/** When a quiet that starts at `now` rings the alarm again. */
export const quietEndsAt = (now: number): number => now + EMERGENCY_QUIET_MS;

type StoredAlarm = Pick<ScheduledAlarm, "alarmId" | "alarmType" | "triggerTime" | "quietUsed">;

// Only quietAlarm makes a quiet key's id; a later snooze has a snooze id.
const isQuietReRing = (alarm: StoredAlarm): boolean =>
  alarm.quietUsed === true &&
  alarm.alarmId ===
    generateDeterministicUUID(getQuietKey(alarm.alarmType, new Date(alarm.triggerTime)));

/** When a stored alarm's running quiet ends; null with none running. */
export const runningQuietEnd = (alarm: StoredAlarm | undefined, now: number): number | null =>
  alarm !== undefined && alarm.triggerTime > now && isQuietReRing(alarm) ? alarm.triggerTime : null;

type OfferInput = Readonly<{
  hasTask: boolean;
  preview: boolean;
  snoozed: boolean;
  /** "Stop alarm" has appeared in the open task run. */
  wayOut: boolean;
  /** This alarm, snoozes included, has had its quiet. */
  used: boolean;
  /** When the running quiet ends; null with none running. */
  quietUntil: number | null;
  allowance: EmergencyQuietAllowance;
  left: number;
}>;

export const quietOfferFor = (input: OfferInput): EmergencyQuietOffer => {
  if (input.quietUntil !== null) return EMERGENCY_QUIET_OFFER.ON;
  if (!input.hasTask || input.preview || input.snoozed || input.wayOut) {
    return EMERGENCY_QUIET_OFFER.HIDDEN;
  }
  if (input.used) return EMERGENCY_QUIET_OFFER.USED;
  if (input.allowance === EMERGENCY_QUIET_ALLOWANCE.OFF) return EMERGENCY_QUIET_OFFER.HIDDEN;
  return input.left > 0 ? EMERGENCY_QUIET_OFFER.OFFER : EMERGENCY_QUIET_OFFER.NONE_LEFT;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isAllowance = (value: unknown): value is EmergencyQuietAllowance =>
  EMERGENCY_QUIET_ALLOWANCES.some((allowance) => allowance === value);

const isCount = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;

const readRaise = (value: unknown): QuietLedger["raise"] | undefined => {
  if (value === null) return null;
  if (isRecord(value) && isAllowance(value.to) && isCount(value.from)) {
    return { to: value.to, from: value.from };
  }
  return undefined;
};

const countOrNull = (value: unknown): number | null | undefined =>
  value === null ? null : isCount(value) ? value : undefined;

/** A saved ledger, or a new one when any field is malformed. */
export const readLedger = (value: unknown): QuietLedger => {
  if (!isRecord(value)) return NEW_QUIET_LEDGER;
  const { allowance, used } = value;
  const raise = readRaise(value.raise);
  const month = countOrNull(value.month);
  const lastWriteAt = countOrNull(value.lastWriteAt);
  if (
    !isAllowance(allowance) ||
    !isCount(used) ||
    raise === undefined ||
    month === undefined ||
    lastWriteAt === undefined
  ) {
    return NEW_QUIET_LEDGER;
  }
  return { allowance, raise, month, used, lastWriteAt };
};

/** The ledger in a saved store's state, read as `readLedger` reads it. */
export const readPersistedLedger = (persisted: unknown): QuietLedger =>
  readLedger(isRecord(persisted) ? persisted.ledger : undefined);
