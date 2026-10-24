import {
  ONBOARDING_STEP as S,
  ONBOARDING_STEP_IDS,
  type OnboardingStepId,
} from "@/constants/Onboarding";

/** What the column reads from the device and the session. */
export type ColumnInput = {
  languageRequested: boolean;
  hasCity: boolean;
  choseAutomaticLocation: boolean;
  locationPermissionGranted: boolean;
  todayStored: boolean;
  /** The fetch step has run in this session; it keeps its place. */
  fetchStarted: boolean;
  notificationsGranted: boolean;
  /** Alarms can ring here, at a verified place's times. */
  alarmsOffered: boolean;
  fajrAlarmOn: boolean;
  fridayAlarmOn: boolean;
};

/** A step's place in the fixed order. */
export const stepRank = (id: OnboardingStepId) => ONBOARDING_STEP_IDS.indexOf(id);

/** The steps this device still needs, in order. */
export const onboardingColumn = (input: ColumnInput): OnboardingStepId[] => {
  const located =
    input.hasCity || (input.choseAutomaticLocation && input.locationPermissionGranted);
  const shows: Record<OnboardingStepId, boolean> = {
    [S.WELCOME]: true,
    [S.LANGUAGE]: input.languageRequested,
    [S.NUMERALS]: true,
    [S.APPEARANCE]: true,
    [S.TEXT_SIZE]: true,
    [S.LOCATION]: !input.hasCity,
    // A stored city answers the location question; no prime is needed.
    [S.LOCATION_PERMISSION]:
      !input.hasCity && input.choseAutomaticLocation && !input.locationPermissionGranted,
    [S.FETCH]: located && (!input.todayStored || input.fetchStarted),
    [S.CALCULATION]: input.todayStored,
    [S.NOTIFICATIONS]: !input.notificationsGranted,
    [S.FAJR_ALARM]: input.alarmsOffered && !input.fajrAlarmOn,
    [S.FRIDAY_ALARM]: input.alarmsOffered && !input.fridayAlarmOn,
    [S.COMPLETE]: true,
  };
  return ONBOARDING_STEP_IDS.filter((id) => shows[id]);
};

/** A step's place in the count: `current` of `total`, from 1. */
type CountedPlace = { current: number; total: number };

/** The first and last pages stand outside the count. */
const UNCOUNTED: ReadonlySet<OnboardingStepId> = new Set([S.WELCOME, S.COMPLETE]);

/** Shown steps count with the column, so a step that leaves keeps its place. */
export const countedPlace = (
  column: readonly OnboardingStepId[],
  shown: ReadonlySet<OnboardingStepId>,
  id: OnboardingStepId
): CountedPlace | null => {
  const counted = ONBOARDING_STEP_IDS.filter(
    (step) => (shown.has(step) || column.includes(step)) && !UNCOUNTED.has(step)
  );
  const at = counted.indexOf(id);
  return at < 0 ? null : { current: at + 1, total: counted.length };
};

/** Index of a step in the column; a removed step maps to the next one. */
export const resolveIndex = (
  column: readonly OnboardingStepId[],
  stepId: OnboardingStepId | null
): number => {
  if (stepId === null) return 0;
  const at = column.indexOf(stepId);
  if (at >= 0) return at;
  const next = column.findIndex((id) => stepRank(id) > stepRank(stepId));
  return next >= 0 ? next : column.length - 1;
};
