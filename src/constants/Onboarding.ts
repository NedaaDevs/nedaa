/** Every step: the first run's in order, then the upgrade path's own two. */
export const ONBOARDING_STEP = {
  WELCOME: "welcome",
  LANGUAGE: "language",
  NUMERALS: "numerals",
  APPEARANCE: "appearance",
  TEXT_SIZE: "textSize",
  LOCATION: "location",
  LOCATION_PERMISSION: "locationPermission",
  FETCH: "fetch",
  CALCULATION: "calculation",
  NOTIFICATIONS: "notifications",
  FAJR_ALARM: "fajrAlarm",
  FRIDAY_ALARM: "fridayAlarm",
  COMPLETE: "complete",
  UPGRADE_WELCOME: "upgradeWelcome",
  UPGRADE_COMPLETE: "upgradeComplete",
} as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP)[keyof typeof ONBOARDING_STEP];

/** Every step id; a first-run column is a subsequence of it. */
export const ONBOARDING_STEP_IDS: readonly OnboardingStepId[] = Object.values(ONBOARDING_STEP);

const S = ONBOARDING_STEP;

/** The upgrade path's steps in its order; its column is a subsequence of it. */
export const UPGRADE_STEP_ORDER = [
  S.UPGRADE_WELCOME,
  S.APPEARANCE,
  S.TEXT_SIZE,
  S.NUMERALS,
  S.LOCATION,
  S.LOCATION_PERMISSION,
  S.FETCH,
  S.CALCULATION,
  S.NOTIFICATIONS,
  S.UPGRADE_COMPLETE,
] as const satisfies readonly OnboardingStepId[];

export type UpgradeStepId = (typeof UPGRADE_STEP_ORDER)[number];

/** Whether a saved value names a step this build can show. */
export const isOnboardingStepId = (value: unknown): value is OnboardingStepId =>
  ONBOARDING_STEP_IDS.some((step) => step === value);

/** The gate's walk: the whole first run, or a 2.x user's V3 choices. */
export const ONBOARDING_PATH = { FIRST_RUN: "firstRun", UPGRADE: "upgrade" } as const;
export type OnboardingPath = (typeof ONBOARDING_PATH)[keyof typeof ONBOARDING_PATH];

/** The order each walk ranks its steps in. */
export const STEP_ORDER: Record<OnboardingPath, readonly OnboardingStepId[]> = {
  [ONBOARDING_PATH.FIRST_RUN]: ONBOARDING_STEP_IDS,
  [ONBOARDING_PATH.UPGRADE]: UPGRADE_STEP_ORDER,
};

/** The last step of each walk; moving on from it ends the walk. */
export const LAST_STEP: Record<OnboardingPath, OnboardingStepId> = {
  [ONBOARDING_PATH.FIRST_RUN]: S.COMPLETE,
  [ONBOARDING_PATH.UPGRADE]: S.UPGRADE_COMPLETE,
};

/** testIDs of the flow's parts, for the Maestro flows and the tests. */
export const ONBOARDING_PART = {
  FRAME: "onboarding-frame",
  CONTINUE: "onboarding-continue",
  SKIP: "onboarding-skip",
  BACK: "onboarding-back",
  PROGRESS: "onboarding-progress",
  PROGRESS_FILL: "onboarding-progress-fill",
  PREVIEW: "onboarding-preview",
  PREVIEW_TIMES: "onboarding-preview-times",
  /** Prefix: each chip is `${PREVIEW_CHIP}-${prayer id}`. */
  PREVIEW_CHIP: "onboarding-preview-chip",
  TRANSITION: "onboarding-transition",
  /** The location step's choice of a city by hand. */
  LOCATION_CITY: "onboarding-location-city",
  CHOOSE_CITY: "onboarding-choose-city",
  NOTIFICATIONS_DENIED: "onboarding-notifications-denied",
  ALARM_TURN_ON: "onboarding-alarm-turn-on",
  ALARM_LATER: "onboarding-alarm-later",
  ALARM_RETRY: "onboarding-alarm-retry",
  ALARM_RESULT: "onboarding-alarm-result",
  /** Prefix: each item's tick is `${ALARM_TICK}-${item id}`. */
  ALARM_TICK: "onboarding-alarm-tick",
  ALARM_BAR_ON: "onboarding-alarm-bar-on",
  ALARM_BAR_OFF: "onboarding-alarm-bar-off",
  /** The appearance step's Today preview and the day button under it. */
  APPEARANCE_PREVIEW: "onboarding-appearance-preview",
  COMPLETE_OPEN: "onboarding-complete-open",
  LANDING_FLOW: "onboarding-landing-flow",
  LOADING: "onboarding-loading",
  LOADING_SPINNER: "onboarding-loading-spinner",
} as const;

/** What the frame draws around a step: the sky alone, or the bars as well. */
export const FRAME_MODE = { BARE: "bare", CHROME: "chrome" } as const;
export type FrameMode = (typeof FRAME_MODE)[keyof typeof FRAME_MODE];

/** The way a step change moves through the column. */
export const STEP_DIRECTION = { FORWARD: 1, BACK: -1 } as const;
export type StepDirection = (typeof STEP_DIRECTION)[keyof typeof STEP_DIRECTION];

/** Step motion: enter offset, durations and the ease-out curve. */
export const STEP_MOTION = {
  ENTER_PX: 24,
  FORWARD_MS: 260,
  BACK_MS: 240,
  REDUCED_MS: 120,
  CURVE: [0.2, 0.72, 0.2, 1],
} as const;

/** Frame input pause after a step arrives; a double tap moves once. */
export const STEP_LOCK_MS = STEP_MOTION.FORWARD_MS;

/** A stalled store load stops holding the column back after this long. */
export const ONBOARDING_HYDRATION_TIMEOUT_MS = 5000;

/** A read with no answer by now keeps what is known; a first read is a no. */
export const NATIVE_READ_TIMEOUT_MS = 3000;

/** A column read within this shows the bare sky, never a loading flash. */
export const ONBOARDING_LOADING_DELAY_MS = 300;

/** A prayer time not yet known; the preview never invents one. */
export const TIME_PLACEHOLDER = "—:—";

/** The preview's fill-in, and the pulse of its times while they load. */
export const PREVIEW_MOTION = {
  FADE_MS: 180,
  STAGGER_MS: 25,
  /** One full pulse, down and back up. */
  PULSE_MS: 1100,
  PULSE_OPACITY: 0.5,
} as const;

/** A fixed clock time the numerals step formats; it is not a prayer time. */
export const CLOCK_SAMPLE = { ISO: "2026-01-01T16:35:00.000Z", TIMEZONE: "UTC" } as const;

/** How the location step finds the place. */
export const LOCATION_CHOICE = { AUTOMATIC: "automatic", CITY: "city" } as const;
export type LocationChoice = (typeof LOCATION_CHOICE)[keyof typeof LOCATION_CHOICE];

/** What the location step shows: the two choices, or the city picker. */
export const LOCATION_STEP_VIEW = { CHOICE: "choice", PICKER: "picker" } as const;
export type LocationStepView = (typeof LOCATION_STEP_VIEW)[keyof typeof LOCATION_STEP_VIEW];

/** The fetch step waits this long before its one silent retry. */
export const FETCH_RETRY_MS = 1500;

/** One fetch attempt with no answer by now counts as failed. */
export const FETCH_ATTEMPT_TIMEOUT_MS = 20000;

/** What the fetch step shows: loading, the error state, or the city picker. */
export const FETCH_PHASE = { LOADING: "loading", ERROR: "error", PICKER: "picker" } as const;
export type FetchPhase = (typeof FETCH_PHASE)[keyof typeof FETCH_PHASE];

/** What a fetch attempt waits on: the device's fix, then the times. */
export const FETCH_STAGE = {
  LOCATING_DEVICE: "locatingDevice",
  LOADING_TIMES: "loadingTimes",
} as const;
export type FetchStage = (typeof FETCH_STAGE)[keyof typeof FETCH_STAGE];

/** An alarm step: the question, the permission sequence, then its result. */
export const ALARM_STEP_PHASE = {
  ASK: "ask",
  /** Already on: its items are read before the result shows. */
  CHECK: "check",
  SEQUENCE: "sequence",
  DONE: "done",
  NOT_ON: "notOn",
} as const;
export type AlarmStepPhase = (typeof ALARM_STEP_PHASE)[keyof typeof ALARM_STEP_PHASE];

/** A settings screen that has not taken the app away by now never opened. */
export const SETTINGS_OPEN_GRACE_MS = 1000;

/** The crossfade from the last step to Today. */
export const LANDING_MS = 320;
