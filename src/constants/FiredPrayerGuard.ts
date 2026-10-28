// kv-store keys of the two ledgers of booked prayer alerts.
export const FIRED_LEDGER = {
  NOTIFICATIONS: "fired-prayer-notifications",
  ALARMS: "fired-prayer-alarms",
} as const;

export type FiredLedger = (typeof FIRED_LEDGER)[keyof typeof FIRED_LEDGER];
