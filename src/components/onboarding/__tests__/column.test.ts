import {
  ONBOARDING_STEP as S,
  ONBOARDING_STEP_IDS,
  UPGRADE_STEP_ORDER,
  type OnboardingStepId,
} from "@/constants/Onboarding";
import {
  countedPlace,
  resolveIndex,
  stepRank,
  type ColumnInput,
} from "@/components/onboarding/column";
import { columnFor, upgradeColumnFor } from "@/test-helpers/onboardingColumn";

const FIRST_RUN_ORDER = ONBOARDING_STEP_IDS;
const UPGRADE_STEPS: readonly OnboardingStepId[] = [S.UPGRADE_WELCOME, S.UPGRADE_COMPLETE];
const ALARM_STEPS: readonly OnboardingStepId[] = [S.FAJR_ALARM, S.FRIDAY_ALARM];

describe("onboardingColumn", () => {
  it.each<[string, Partial<ColumnInput>, string[]]>([
    [
      "a fresh install",
      {},
      [S.WELCOME, S.NUMERALS, S.APPEARANCE, S.TEXT_SIZE, S.LOCATION, S.NOTIFICATIONS, S.COMPLETE],
    ],
    [
      "a language request",
      { languageRequested: true },
      [
        S.WELCOME,
        S.LANGUAGE,
        S.NUMERALS,
        S.APPEARANCE,
        S.TEXT_SIZE,
        S.LOCATION,
        S.NOTIFICATIONS,
        S.COMPLETE,
      ],
    ],
    [
      "automatic location, no permission",
      { choseAutomaticLocation: true },
      [
        S.WELCOME,
        S.NUMERALS,
        S.APPEARANCE,
        S.TEXT_SIZE,
        S.LOCATION,
        S.LOCATION_PERMISSION,
        S.NOTIFICATIONS,
        S.COMPLETE,
      ],
    ],
    [
      "automatic location granted",
      { choseAutomaticLocation: true, locationPermissionGranted: true },
      [
        S.WELCOME,
        S.NUMERALS,
        S.APPEARANCE,
        S.TEXT_SIZE,
        S.LOCATION,
        S.FETCH,
        S.NOTIFICATIONS,
        S.COMPLETE,
      ],
    ],
    [
      "a city, times stored",
      { hasCity: true, todayStored: true, fetchStarted: true, alarmsOffered: true },
      [
        S.WELCOME,
        S.NUMERALS,
        S.APPEARANCE,
        S.TEXT_SIZE,
        S.FETCH,
        S.CALCULATION,
        S.NOTIFICATIONS,
        S.FAJR_ALARM,
        S.FRIDAY_ALARM,
        S.COMPLETE,
      ],
    ],
    [
      "everything granted and on",
      {
        hasCity: true,
        todayStored: true,
        fetchStarted: true,
        notificationsGranted: true,
        alarmsOffered: true,
        fajrAlarmOn: true,
        fridayAlarmOn: true,
      },
      [S.WELCOME, S.NUMERALS, S.APPEARANCE, S.TEXT_SIZE, S.FETCH, S.CALCULATION, S.COMPLETE],
    ],
  ])("orders the steps for %s", (_, patch, expected) => {
    expect(columnFor(patch)).toEqual(expected);
  });

  it("keeps a fetch that has run once the day is stored, so back can reach it", () => {
    const stored = { hasCity: true, todayStored: true };
    expect(columnFor({ ...stored, fetchStarted: true })).toContain(S.FETCH);
    expect(columnFor({ ...stored, fetchStarted: false })).not.toContain(S.FETCH);
  });

  // A resume on the prime keeps the automatic choice; a stored city answers it.
  it("asks for no location permission once a city is stored", () => {
    expect(columnFor({ hasCity: true, choseAutomaticLocation: true })).not.toContain(
      S.LOCATION_PERMISSION
    );
  });

  // An alarm turns on only where it can ring, at a verified place's times.
  it.each<[string, Partial<ColumnInput>, string[]]>([
    ["alarms not offered", { alarmsOffered: false }, []],
    ["alarms offered", { alarmsOffered: true }, [S.FAJR_ALARM, S.FRIDAY_ALARM]],
    [
      "alarms offered, Fajr already on",
      { alarmsOffered: true, fajrAlarmOn: true },
      [S.FRIDAY_ALARM],
    ],
    [
      "alarms offered, Jummah already on",
      { alarmsOffered: true, fridayAlarmOn: true },
      [S.FAJR_ALARM],
    ],
  ])("offers the alarm steps for %s", (_, patch, expected) => {
    const alarmSteps = new Set<string>([S.FAJR_ALARM, S.FRIDAY_ALARM]);
    const column = columnFor({ hasCity: true, todayStored: true, ...patch });
    expect(column.filter((id) => alarmSteps.has(id))).toEqual(expected);
  });

  it("drops calculation when no day is stored", () => {
    expect(columnFor({ hasCity: true, fetchStarted: true })).not.toContain(S.CALCULATION);
  });

  it.each<[string, Partial<ColumnInput>]>([
    ["a fresh install", {}],
    ["a city, times stored", { hasCity: true, hadCity: true, todayStored: true }],
    ["notifications never asked", { notificationsUndetermined: true }],
  ])("never shows the upgrade steps on a first run for %s", (_, patch) => {
    expect(columnFor(patch).filter((id) => UPGRADE_STEPS.includes(id))).toEqual([]);
  });
});

describe("upgradeColumn", () => {
  it("an upgrader with a city sees only the V3 choices", () => {
    expect(upgradeColumnFor()).toEqual([
      S.UPGRADE_WELCOME,
      S.APPEARANCE,
      S.TEXT_SIZE,
      S.NUMERALS,
      S.UPGRADE_COMPLETE,
    ]);
  });

  it("an upgrader without a city also sees the location steps and calculation", () => {
    const noCity = { hasCity: false, hadCity: false, todayStored: false };
    const automatic = { ...noCity, choseAutomaticLocation: true };
    const granted = { ...automatic, locationPermissionGranted: true };
    const stored = { ...granted, todayStored: true, fetchStarted: true };
    const choices = [S.UPGRADE_WELCOME, S.APPEARANCE, S.TEXT_SIZE, S.NUMERALS];

    expect(upgradeColumnFor(noCity)).toEqual([...choices, S.LOCATION, S.UPGRADE_COMPLETE]);
    expect(upgradeColumnFor(automatic)).toEqual([
      ...choices,
      S.LOCATION,
      S.LOCATION_PERMISSION,
      S.UPGRADE_COMPLETE,
    ]);
    expect(upgradeColumnFor(granted)).toEqual([
      ...choices,
      S.LOCATION,
      S.FETCH,
      S.UPGRADE_COMPLETE,
    ]);
    expect(upgradeColumnFor(stored)).toEqual([
      ...choices,
      S.LOCATION,
      S.FETCH,
      S.CALCULATION,
      S.UPGRADE_COMPLETE,
    ]);
  });

  // A city picked on the path keeps the fetch and calculation that follow it.
  it("keeps the fetch and calculation once a city is picked on the path", () => {
    const picked = { hasCity: true, hadCity: false, todayStored: true, fetchStarted: true };

    expect(upgradeColumnFor(picked)).toEqual(expect.arrayContaining([S.FETCH, S.CALCULATION]));
  });

  it("notifications show only when never asked", () => {
    expect(upgradeColumnFor({ notificationsUndetermined: true })).toContain(S.NOTIFICATIONS);
    expect(
      upgradeColumnFor({ notificationsUndetermined: false, notificationsGranted: false })
    ).not.toContain(S.NOTIFICATIONS);
  });

  it.each<[string, Partial<ColumnInput>]>([
    ["alarms offered and off", { alarmsOffered: true }],
    ["no city, alarms offered", { hasCity: false, hadCity: false, alarmsOffered: true }],
    ["notifications never asked", { alarmsOffered: true, notificationsUndetermined: true }],
  ])("alarm steps never show on the upgrade path: %s", (_, patch) => {
    expect(upgradeColumnFor(patch).filter((id) => ALARM_STEPS.includes(id))).toEqual([]);
  });

  it("follows its own order, Appearance before Numerals", () => {
    const column = upgradeColumnFor({ hasCity: false, hadCity: false });
    const ranks = column.map((id) => stepRank(UPGRADE_STEP_ORDER, id));

    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(column.indexOf(S.APPEARANCE)).toBeLessThan(column.indexOf(S.NUMERALS));
  });
});

describe("stepRank", () => {
  it("ranks the steps in the order it is given", () => {
    for (const order of [FIRST_RUN_ORDER, UPGRADE_STEP_ORDER]) {
      expect(order.map((id) => stepRank(order, id))).toEqual(order.map((_, index) => index));
    }
  });
});

describe("resolveIndex", () => {
  const column = columnFor({
    hasCity: true,
    todayStored: true,
    fetchStarted: true,
    alarmsOffered: true,
  });

  it("finds the step by id", () => {
    expect(resolveIndex(FIRST_RUN_ORDER, column, S.CALCULATION)).toBe(
      column.indexOf(S.CALCULATION)
    );
  });

  // A step that leaves the column resolves to the next step still shown.
  it("a removed step resolves forward", () => {
    const without = column.filter((id) => id !== S.NOTIFICATIONS);
    expect(without[resolveIndex(FIRST_RUN_ORDER, without, S.NOTIFICATIONS)]).toBe(S.FAJR_ALARM);
  });

  // Text size comes before Numerals on the upgrade path only.
  it("resolves a removed step forward in the order it is given", () => {
    const upgrade = [S.UPGRADE_WELCOME, S.APPEARANCE, S.NUMERALS, S.UPGRADE_COMPLETE];

    expect(upgrade[resolveIndex(UPGRADE_STEP_ORDER, upgrade, S.TEXT_SIZE)]).toBe(S.NUMERALS);
  });

  it("starts at the beginning with no step", () => {
    expect(resolveIndex(FIRST_RUN_ORDER, column, null)).toBe(0);
  });

  // A kill mid-fetch resumes at the fetch, or after it once today is stored.
  it("resumes a kill mid-fetch at the fetch, or past it once today is stored", () => {
    const before = columnFor({ hasCity: true });
    expect(before[resolveIndex(FIRST_RUN_ORDER, before, S.FETCH)]).toBe(S.FETCH);
    const after = columnFor({ hasCity: true, todayStored: true });
    expect(after[resolveIndex(FIRST_RUN_ORDER, after, S.FETCH)]).toBe(S.CALCULATION);
  });
});

describe("countedPlace", () => {
  const column = [S.WELCOME, S.LANGUAGE, S.NUMERALS, S.COMPLETE];
  const NONE_SHOWN = new Set<OnboardingStepId>();

  it("leaves Welcome and Completion outside the count", () => {
    expect(countedPlace(FIRST_RUN_ORDER, column, NONE_SHOWN, S.WELCOME)).toBeNull();
    expect(countedPlace(FIRST_RUN_ORDER, column, NONE_SHOWN, S.COMPLETE)).toBeNull();
  });

  it("counts from the page after Welcome, over the column less Welcome and Completion", () => {
    expect(countedPlace(FIRST_RUN_ORDER, column, NONE_SHOWN, S.LANGUAGE)).toEqual({
      current: 1,
      total: 2,
    });
    expect(countedPlace(FIRST_RUN_ORDER, column, NONE_SHOWN, S.NUMERALS)).toEqual({
      current: 2,
      total: 2,
    });
  });

  it("gives a step neither shown nor in the column no place", () => {
    expect(countedPlace(FIRST_RUN_ORDER, column, NONE_SHOWN, S.FETCH)).toBeNull();
  });

  it("keeps the place of a shown step that left the column", () => {
    const shown = new Set<OnboardingStepId>([S.WELCOME, S.LANGUAGE]);
    const withoutLanguage = [S.WELCOME, S.NUMERALS, S.COMPLETE];
    expect(countedPlace(FIRST_RUN_ORDER, withoutLanguage, shown, S.NUMERALS)).toEqual({
      current: 2,
      total: 2,
    });
  });

  // Automatic location: the prime joins and leaves, then the fetch adds more.
  it("raises the number by one on each forward move while steps join and leave", () => {
    const shown = new Set<OnboardingStepId>([S.WELCOME, S.NUMERALS, S.APPEARANCE, S.TEXT_SIZE]);
    const offered = { alarmsOffered: true };
    const automatic = { ...offered, choseAutomaticLocation: true };
    const granted = { ...automatic, locationPermissionGranted: true };
    const trace: [OnboardingStepId, Partial<ColumnInput>][] = [
      [S.LOCATION, offered],
      [S.LOCATION_PERMISSION, automatic],
      [S.FETCH, granted],
      [S.CALCULATION, { ...granted, todayStored: true, fetchStarted: true }],
    ];

    const places = trace.map(([id, patch]) => {
      shown.add(id);
      return countedPlace(FIRST_RUN_ORDER, columnFor(patch), shown, id);
    });

    expect(places).toEqual([
      { current: 4, total: 7 },
      { current: 5, total: 8 },
      { current: 6, total: 9 },
      { current: 7, total: 10 },
    ]);
  });

  it("leaves the upgrade welcome and completion outside the count", () => {
    const upgrade = upgradeColumnFor();

    expect(countedPlace(UPGRADE_STEP_ORDER, upgrade, NONE_SHOWN, S.UPGRADE_WELCOME)).toBeNull();
    expect(countedPlace(UPGRADE_STEP_ORDER, upgrade, NONE_SHOWN, S.UPGRADE_COMPLETE)).toBeNull();
  });

  it("Appearance is step 1 of 3", () => {
    const upgrade = upgradeColumnFor();

    expect(countedPlace(UPGRADE_STEP_ORDER, upgrade, NONE_SHOWN, S.APPEARANCE)).toEqual({
      current: 1,
      total: 3,
    });
    expect(countedPlace(UPGRADE_STEP_ORDER, upgrade, NONE_SHOWN, S.NUMERALS)).toEqual({
      current: 3,
      total: 3,
    });
  });
});
