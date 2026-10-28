/** What a day run is for: a debug tool on Today, or the onboarding preview. */
export const DAY_RUN_KIND = {
  DEBUG: "debug",
  PREVIEW: "preview",
} as const;

export type DayRunKind = (typeof DAY_RUN_KIND)[keyof typeof DAY_RUN_KIND];

export const DAY_RUN_STATUS = {
  IDLE: "idle",
  PLAYING: "playing",
  PAUSED: "paused",
  ENDED: "ended",
} as const;

export type DayRunStatus = (typeof DAY_RUN_STATUS)[keyof typeof DAY_RUN_STATUS];

/** How a run spends its time: by the clock, or the same time on every phase. */
export const DAY_RUN_PACE = {
  LINEAR: "linear",
  EQUAL_PHASES: "equalPhases",
} as const;

export type DayRunPace = (typeof DAY_RUN_PACE)[keyof typeof DAY_RUN_PACE];

/** How far before Fajr a run starts. */
export const DAY_RUN_MARGIN_MS = 30 * 60_000;

type DayRunConfig =
  | {
      pace: typeof DAY_RUN_PACE.LINEAR;
      tickMs: number;
      /** Clock time that passes in one tick. */
      stepMs: number;
    }
  | {
      pace: typeof DAY_RUN_PACE.EQUAL_PHASES;
      tickMs: number;
      /** Real time each phase takes. */
      phaseMs: number;
      /** Real time the lead-in before Fajr takes. */
      preludeMs: number;
    };

/** Debug: 5 minutes every 50ms, about 15s in all. Preview: 2s a phase. */
export const DAY_RUN = {
  [DAY_RUN_KIND.DEBUG]: {
    pace: DAY_RUN_PACE.LINEAR,
    tickMs: 50,
    stepMs: 5 * 60_000,
  },
  [DAY_RUN_KIND.PREVIEW]: {
    pace: DAY_RUN_PACE.EQUAL_PHASES,
    tickMs: 50,
    phaseMs: 2000,
    preludeMs: 700,
  },
} as const satisfies Record<DayRunKind, DayRunConfig>;

/** The label of the debug run's button on Today. */
export const DAY_RUN_DEBUG_LABEL = "Simulate a day";

/** Two-digit hours, morning and evening: as wide as any clock a run shows. */
export const DAY_RUN_WIDEST_CLOCK = {
  ISOS: ["2026-01-01T10:58:00.000Z", "2026-01-01T22:58:00.000Z"],
  TIMEZONE: "UTC",
} as const;
