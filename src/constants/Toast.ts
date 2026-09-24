/** What a toast reports; each kind has its own icon, colour and dwell. */
export const TOAST_KIND = {
  SUCCESS: "success",
  /** A plain statement: neither an outcome nor work under way. */
  INFO: "info",
  /** Work under way; its icon turns until the outcome replaces it. */
  PROGRESS: "progress",
  WARNING: "warning",
  ERROR: "error",
} as const;

export type ToastKind = (typeof TOAST_KIND)[keyof typeof TOAST_KIND];

/** How long each kind stays before it leaves on its own. */
export const TOAST_DWELL_MS = {
  [TOAST_KIND.SUCCESS]: 3000,
  [TOAST_KIND.INFO]: 4000,
  [TOAST_KIND.PROGRESS]: 8000,
  [TOAST_KIND.WARNING]: 6000,
  [TOAST_KIND.ERROR]: 8000,
} as const satisfies Record<ToastKind, number>;

export const TOAST_TIMING = {
  /** Extra time to reach a toast's action. */
  actionExtraMs: 2000,
  /** A screen reader reads the whole message before anyone can act on it. */
  screenReaderFactor: 2,
} as const;

export const TOAST_MOTION = {
  enterMs: 180,
  exitMs: 140,
  /** Under Reduce Motion: a fade, no travel. */
  reducedMs: 120,
  /** How far it rises on arrival and drops on leaving, in points. */
  rise: 8,
  drop: 5,
  /** One turn of the progress icon. */
  spinMs: 1100,
} as const;

export const TOAST_SWIPE = {
  /** A drag starts moving the toast after this many points down. */
  startAt: 8,
  /** A downward drag past this many points dismisses. */
  dismissAt: 24,
  /** The drag fades by one over this many points, never below `minOpacity`. */
  fadeOver: 90,
  minOpacity: 0.3,
} as const;

/** Room between the toast and whatever sits below it, in points. */
export const TOAST_GAP = 16;

/** Distance from each side of the screen, in points. */
export const TOAST_EDGE = 12;
