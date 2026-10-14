import { ONBOARDING_STEP as S, type OnboardingStepId } from "@/constants/Onboarding";
import {
  countedPlace,
  resolveIndex,
  stepRank,
  type ColumnInput,
} from "@/components/onboarding/column";
import { columnFor } from "@/test-helpers/onboardingColumn";

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
});

describe("stepRank", () => {
  it("ranks the steps in their fixed order", () => {
    const ids: OnboardingStepId[] = Object.values(S);
    expect(ids.map(stepRank)).toEqual(ids.map((_, index) => index));
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
    expect(resolveIndex(column, S.CALCULATION)).toBe(column.indexOf(S.CALCULATION));
  });

  // A step that leaves the column resolves to the next step still shown.
  it("a removed step resolves forward", () => {
    const without = column.filter((id) => id !== S.NOTIFICATIONS);
    expect(without[resolveIndex(without, S.NOTIFICATIONS)]).toBe(S.FAJR_ALARM);
  });

  it("starts at the beginning with no step", () => {
    expect(resolveIndex(column, null)).toBe(0);
  });

  // A kill mid-fetch resumes at the fetch, or after it once today is stored.
  it("resumes a kill mid-fetch at the fetch, or past it once today is stored", () => {
    const before = columnFor({ hasCity: true });
    expect(before[resolveIndex(before, S.FETCH)]).toBe(S.FETCH);
    const after = columnFor({ hasCity: true, todayStored: true });
    expect(after[resolveIndex(after, S.FETCH)]).toBe(S.CALCULATION);
  });
});

describe("countedPlace", () => {
  const column = [S.WELCOME, S.LANGUAGE, S.NUMERALS, S.COMPLETE];
  const NONE_SHOWN = new Set<OnboardingStepId>();

  it("leaves Welcome and Completion outside the count", () => {
    expect(countedPlace(column, NONE_SHOWN, S.WELCOME)).toBeNull();
    expect(countedPlace(column, NONE_SHOWN, S.COMPLETE)).toBeNull();
  });

  it("counts from the page after Welcome, over the column less Welcome and Completion", () => {
    expect(countedPlace(column, NONE_SHOWN, S.LANGUAGE)).toEqual({ current: 1, total: 2 });
    expect(countedPlace(column, NONE_SHOWN, S.NUMERALS)).toEqual({ current: 2, total: 2 });
  });

  it("gives a step neither shown nor in the column no place", () => {
    expect(countedPlace(column, NONE_SHOWN, S.FETCH)).toBeNull();
  });

  it("keeps the place of a shown step that left the column", () => {
    const shown = new Set<OnboardingStepId>([S.WELCOME, S.LANGUAGE]);
    const withoutLanguage = [S.WELCOME, S.NUMERALS, S.COMPLETE];
    expect(countedPlace(withoutLanguage, shown, S.NUMERALS)).toEqual({ current: 2, total: 2 });
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
      return countedPlace(columnFor(patch), shown, id);
    });

    expect(places).toEqual([
      { current: 4, total: 7 },
      { current: 5, total: 8 },
      { current: 6, total: 9 },
      { current: 7, total: 10 },
    ]);
  });
});
