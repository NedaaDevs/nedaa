/** How long a finished dhikr stays up before the next one opens. */
export const ADVANCE_PAUSE_MS = 600;

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

/** The search params that name the collection Focus opens; none is the daily session. */
export const FOCUS_PARAM = { SOURCE: "source", ID: "id" } as const;

/** Count writes wait this long for taps to settle. */
export const COUNT_WRITE_DELAY_MS = 300;

/** What a session is read over: a period of the day, a saved Hisn topic, a custom group. */
export const SESSION_SOURCE = { DAILY: "daily", HISN: "hisn", CUSTOM: "custom" } as const;

/** A group a person saved in My Athkar. */
export type CollectionSource =
  | { kind: typeof SESSION_SOURCE.HISN; categoryId: number }
  | { kind: typeof SESSION_SOURCE.CUSTOM; groupId: number };

/** The daily source reads the period the Athkar store is on. */
export type SessionSource = { kind: typeof SESSION_SOURCE.DAILY } | CollectionSource;

/** How a dhikr's words are held: a locale key, or the words themselves. */
export const DHIKR_TEXT = { KEY: "key", RAW: "raw" } as const;
