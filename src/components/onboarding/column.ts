import {
  ONBOARDING_PATH,
  ONBOARDING_STEP as S,
  ONBOARDING_STEP_IDS,
  UPGRADE_STEP_ORDER,
  type OnboardingPath,
  type OnboardingStepId,
  type UpgradeStepId,
} from "@/constants/Onboarding";

/** What the column reads from the device and the session. */
export type ColumnInput = {
  languageRequested: boolean;
  /** A city stored before this run or picked in it. */
  hasCity: boolean;
  /** A city stored before this run; the upgrade path then asks for no place. */
  hadCity: boolean;
  choseAutomaticLocation: boolean;
  locationPermissionGranted: boolean;
  todayStored: boolean;
  /** The fetch step has run in this session; it keeps its place. */
  fetchStarted: boolean;
  notificationsGranted: boolean;
  /** The OS has never asked for notifications on this device. */
  notificationsUndetermined: boolean;
  /** Alarms can ring here, at a verified place's times. */
  alarmsOffered: boolean;
  fajrAlarmOn: boolean;
  fridayAlarmOn: boolean;
};

/** A step's place in `order`; -1 for a step the order lacks. */
export const stepRank = (order: readonly OnboardingStepId[], id: OnboardingStepId) =>
  order.indexOf(id);

/** Whether the device has a place: a city, or a granted automatic choice. */
const isLocated = (input: ColumnInput) =>
  input.hasCity || (input.choseAutomaticLocation && input.locationPermissionGranted);

// A stored city answers the location question; no prime is needed.
const asksLocationPermission = (input: ColumnInput) =>
  !input.hasCity && input.choseAutomaticLocation && !input.locationPermissionGranted;

const showsFetch = (input: ColumnInput) =>
  isLocated(input) && (!input.todayStored || input.fetchStarted);

/** The first run's steps this device still needs, in order. */
export const onboardingColumn = (input: ColumnInput): OnboardingStepId[] => {
  const shows: Record<OnboardingStepId, boolean> = {
    [S.WELCOME]: true,
    [S.LANGUAGE]: input.languageRequested,
    [S.NUMERALS]: true,
    [S.APPEARANCE]: true,
    [S.TEXT_SIZE]: true,
    [S.LOCATION]: !input.hasCity,
    [S.LOCATION_PERMISSION]: asksLocationPermission(input),
    [S.FETCH]: showsFetch(input),
    [S.CALCULATION]: input.todayStored,
    [S.NOTIFICATIONS]: !input.notificationsGranted,
    [S.FAJR_ALARM]: input.alarmsOffered && !input.fajrAlarmOn,
    [S.FRIDAY_ALARM]: input.alarmsOffered && !input.fridayAlarmOn,
    [S.COMPLETE]: true,
    [S.UPGRADE_WELCOME]: false,
    [S.UPGRADE_COMPLETE]: false,
  };
  return ONBOARDING_STEP_IDS.filter((id) => shows[id]);
};

/** The V3 choices, then only what the 2.x data lacks; never the alarms. */
export const upgradeColumn = (input: ColumnInput): OnboardingStepId[] => {
  const asksPlace = !input.hadCity;
  const shows: Record<UpgradeStepId, boolean> = {
    [S.UPGRADE_WELCOME]: true,
    [S.APPEARANCE]: true,
    [S.TEXT_SIZE]: true,
    [S.NUMERALS]: true,
    [S.LOCATION]: !input.hasCity,
    [S.LOCATION_PERMISSION]: asksLocationPermission(input),
    [S.FETCH]: asksPlace && showsFetch(input),
    [S.CALCULATION]: asksPlace && input.todayStored,
    // A user who said no in 2.x is not asked again.
    [S.NOTIFICATIONS]: input.notificationsUndetermined,
    [S.UPGRADE_COMPLETE]: true,
  };
  return UPGRADE_STEP_ORDER.filter((id) => shows[id]);
};

/** Each walk's column. */
export const PATH_COLUMN: Record<OnboardingPath, (input: ColumnInput) => OnboardingStepId[]> = {
  [ONBOARDING_PATH.FIRST_RUN]: onboardingColumn,
  [ONBOARDING_PATH.UPGRADE]: upgradeColumn,
};

/** A step's place in the count: `current` of `total`, from 1. */
type CountedPlace = { current: number; total: number };

/** The first and last pages stand outside the count. */
const UNCOUNTED: ReadonlySet<OnboardingStepId> = new Set([
  S.WELCOME,
  S.COMPLETE,
  S.UPGRADE_WELCOME,
  S.UPGRADE_COMPLETE,
]);

/** Shown steps count with the column, so a step that leaves keeps its place. */
export const countedPlace = (
  order: readonly OnboardingStepId[],
  column: readonly OnboardingStepId[],
  shown: ReadonlySet<OnboardingStepId>,
  id: OnboardingStepId
): CountedPlace | null => {
  const counted = order.filter(
    (step) => (shown.has(step) || column.includes(step)) && !UNCOUNTED.has(step)
  );
  const at = counted.indexOf(id);
  return at < 0 ? null : { current: at + 1, total: counted.length };
};

/** Index of a step in the column; a removed step maps to the next one. */
export const resolveIndex = (
  order: readonly OnboardingStepId[],
  column: readonly OnboardingStepId[],
  stepId: OnboardingStepId | null
): number => {
  if (stepId === null) return 0;
  const at = column.indexOf(stepId);
  if (at >= 0) return at;
  const next = column.findIndex((id) => stepRank(order, id) > stepRank(order, stepId));
  return next >= 0 ? next : column.length - 1;
};
