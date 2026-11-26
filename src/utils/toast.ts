import {
  TOAST_DWELL_MS,
  TOAST_KIND,
  TOAST_SWIPE,
  TOAST_TIMING,
  type ToastKind,
} from "@/constants/Toast";

export type ToastAction = { label: string; onPress: () => void };

export type ToastContent = {
  kind: ToastKind;
  message: string;
  /** At most one, and only to redo the operation that failed. */
  action?: ToastAction;
  /** Overrides the kind's dwell, for work that waits on a known timeout. */
  durationMs?: number;
};

/** How long a toast stays before it leaves on its own. */
export const toastDwellMs = (toast: ToastContent, screenReader: boolean) => {
  const base =
    toast.durationMs ??
    TOAST_DWELL_MS[toast.kind] + (toast.action ? TOAST_TIMING.actionExtraMs : 0);
  return screenReader ? base * TOAST_TIMING.screenReaderFactor : base;
};

export const SWIPE = { DISMISS: "dismiss", RETURN: "return" } as const;
export type SwipeOutcome = (typeof SWIPE)[keyof typeof SWIPE];

/** Where a released downward drag ends: gone, or back in place. */
export const swipeOutcome = (dy: number): SwipeOutcome =>
  dy > TOAST_SWIPE.dismissAt ? SWIPE.DISMISS : SWIPE.RETURN;

/** An error interrupts the screen reader; anything else waits its turn. */
export const announcementFor = (kind: ToastKind) =>
  kind === TOAST_KIND.ERROR
    ? ({ queue: false, priority: "high" } as const)
    : ({ queue: true } as const);
