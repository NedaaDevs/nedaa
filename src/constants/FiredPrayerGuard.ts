// A move under 180° of longitude shifts a prayer by under 12 h; the next
// day's prayer comes over 12 h after.
export const SAME_OCCURRENCE_WINDOW_MS = 12 * 60 * 60 * 1000;

// kv-store keys of the two ledgers of booked prayer alerts.
export const FIRED_LEDGER = {
  NOTIFICATIONS: "fired-prayer-notifications",
  ALARMS: "fired-prayer-alarms",
} as const;

export type FiredLedger = (typeof FIRED_LEDGER)[keyof typeof FIRED_LEDGER];
