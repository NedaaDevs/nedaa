export const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

/** How long an emergency quiet keeps a ringing alarm silent. */
export const EMERGENCY_QUIET_MINUTES = 5;

export const EMERGENCY_QUIET_MS = EMERGENCY_QUIET_MINUTES * MINUTE_MS;

/** How long "Quiet now" stays disabled after the confirm opens. */
export const QUIET_CONFIRM_WAIT_SECONDS = 2;

/** The monthly allowances the setting offers; OFF offers none. */
export const EMERGENCY_QUIET_ALLOWANCE = { OFF: 0, ONE: 1, TWO: 2, THREE: 3 } as const;

export type EmergencyQuietAllowance =
  (typeof EMERGENCY_QUIET_ALLOWANCE)[keyof typeof EMERGENCY_QUIET_ALLOWANCE];

export const EMERGENCY_QUIET_ALLOWANCES: readonly EmergencyQuietAllowance[] =
  Object.values(EMERGENCY_QUIET_ALLOWANCE);

export const DEFAULT_EMERGENCY_QUIET_ALLOWANCE = EMERGENCY_QUIET_ALLOWANCE.TWO;

/** What a ringing alarm shows of emergency quiet. */
export const EMERGENCY_QUIET_OFFER = {
  HIDDEN: "hidden",
  OFFER: "offer",
  NONE_LEFT: "noneLeft",
  USED: "used",
  ON: "on",
} as const;

export type EmergencyQuietOffer =
  (typeof EMERGENCY_QUIET_OFFER)[keyof typeof EMERGENCY_QUIET_OFFER];

/** Test ids for emergency quiet's parts. */
export const EMERGENCY_QUIET_PART = {
  BUTTON: "emergency-quiet-button",
  NONE_LEFT: "emergency-quiet-none-left",
  USED: "emergency-quiet-used",
  CONFIRM: "emergency-quiet-confirm",
  GO: "emergency-quiet-go",
  WAIT: "emergency-quiet-wait",
  FAILED: "emergency-quiet-failed",
  READY_STATUS: "emergency-quiet-ready-status",
  FAILED_STATUS: "emergency-quiet-failed-status",
  BANNER: "emergency-quiet-banner",
  BANNER_STATUS: "emergency-quiet-banner-status",
  LEFT: "emergency-quiet-left",
  RAISED: "emergency-quiet-raised",
} as const;
