/** How long a finished dhikr stays up before the next one opens. */
export const ADVANCE_PAUSE_MS = 1000;

/** Up to FULL_MAX marks all draw full size; past it, WINDOW marks do, BEFORE of them ahead of the place. */
export const POSITION = { FULL_MAX: 12, WINDOW: 7, BEFORE: 3 } as const;

export const MARK_STATE = { DONE: "done", CURRENT: "current", REMAINING: "remaining" } as const;
export type MarkState = (typeof MARK_STATE)[keyof typeof MARK_STATE];

export const MARK_SIZE = { FULL: "full", FINE: "fine" } as const;
export type MarkSize = (typeof MARK_SIZE)[keyof typeof MARK_SIZE];

export const SESSION_STATUS = { LOADING: "loading", READY: "ready", DONE: "done" } as const;
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

/** The Focus screen's route. */
export const ATHKAR_FOCUS_HREF = "/athkar-focus";
