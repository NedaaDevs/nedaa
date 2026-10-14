// Every step the registry draws: its heading with the count, and its controls.
import type { ViewProps } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import { countedPlace } from "@/components/onboarding/column";
import { STEP_COMPONENT } from "@/components/onboarding/flow/steps";
import type { StepProps } from "@/components/onboarding/flow/types";
import { SkyBackground } from "@/components/ui/sky-background";
import { ALARM_PERMISSION, ALARM_TYPE } from "@/constants/Alarm";
import {
  FETCH_RETRY_MS,
  ONBOARDING_PART,
  ONBOARDING_STEP as S,
  type OnboardingStepId,
} from "@/constants/Onboarding";
import { AppLocale } from "@/enums/app";
import { LocationMode } from "@/enums/location";
import i18n from "@/localization/i18n";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { lastPrimary, stepProps } from "@/test-helpers/onboardingStepProps";
import { RIYADH_DAY } from "@/test-helpers/prayerDay";
import { never } from "@/test-helpers/promises";
import { renderWithTheme } from "@/test-helpers/theme";
import type { AlarmPermission } from "@/utils/alarmPermissions";
import { AppLogger } from "@/utils/appLogger";
import { requestLocationPermission } from "@/utils/location";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/hooks/useAppVisibility", () => ({
  useAppVisibility: () => ({ isActive: true, becameActiveAt: 0 }),
}));
jest.mock("@/services/databases", () => ({ initDatabases: () => Promise.resolve() }));
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => Promise.resolve(null) }));
jest.mock("@/utils/date", () => jest.requireActual("@/test-helpers/hijriDateMock"));
jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  requestLocationPermission: jest.fn(),
}));
jest.mock("@/utils/alarmScheduler", () => ({
  ...jest.requireActual("@/utils/alarmScheduler"),
  rescheduleAllAlarms: jest.fn(() => Promise.resolve()),
}));

/** The alarm items the device reports; a test sets them before it asks. */
let mockAlarmItems: AlarmPermission[] = [];
jest.mock("@/utils/alarmPermissions", () => ({
  ...jest.requireActual("@/utils/alarmPermissions"),
  readAlarmPermissions: () => Promise.resolve(mockAlarmItems),
  requestAlarmPermission: () => Promise.resolve(),
}));
// A system screen stays open until the step leaves.
jest.mock("@/utils/appForeground", () => ({
  nextForeground: (_graceMs: number, signal?: AbortSignal) =>
    new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve())),
}));
// The real city list and coordinate entry: one found city, no update running.
const mockCity = {
  gid: 1,
  name: "Riyadh",
  names: { ar: null, ur: null, ms: null },
  latitude: 24.7,
  longitude: 46.7,
  countryCode: "SA",
  country: { name: "Saudi Arabia", names: { ar: null, ur: null, ms: null } },
  region: null,
  population: 1,
  timezone: "Asia/Riyadh",
};
jest.mock("@/hooks/useCitySearch", () => ({
  useCitySearch: () => ({
    query: "",
    setQuery: () => {},
    results: [mockCity],
    isSearching: false,
    offersFullPack: false,
  }),
}));
jest.mock("@/hooks/useLocationUpdate", () => ({
  useLocationUpdate: () => ({
    updateState: { isUpdating: false, currentStep: null, error: null },
    applyManualLocation: () => new Promise<boolean>(() => {}),
    retry: () => {},
  }),
}));
jest.mock("@/services/cities-db", () => ({
  CitiesDB: { findNearestCity: () => new Promise(() => {}) },
  isFullPackInstalled: () => false,
  invalidateCitiesDb: () => {},
}));

const t = i18n.t.bind(i18n);
const PROGRESS = "2 of 7";
/** Each step's own title; a Record, so a step left out fails the build. */
const TITLE_KEY: Record<OnboardingStepId, string> = {
  [S.WELCOME]: "onboarding.welcome.title",
  [S.LANGUAGE]: "onboarding.language.title",
  [S.NUMERALS]: "onboarding.numerals.title",
  [S.APPEARANCE]: "onboarding.appearance.title",
  [S.TEXT_SIZE]: "onboarding.textSize.chooseTitle",
  [S.LOCATION]: "onboarding.location.question",
  [S.LOCATION_PERMISSION]: "onboarding.locationPermission.title",
  [S.FETCH]: "onboarding.fetch.title",
  [S.CALCULATION]: "onboarding.calculation.title",
  [S.NOTIFICATIONS]: "onboarding.notifications.question",
  [S.FAJR_ALARM]: "onboarding.alarm.fajr.title",
  [S.FRIDAY_ALARM]: "onboarding.alarm.friday.title",
  [S.COMPLETE]: "onboarding.complete.title",
};

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
const flush = () => act(() => jest.advanceTimersByTimeAsync(0));
const renderStep = async (id: OnboardingStepId) => {
  // The flow hands a count only to a step the column counts.
  const counted = countedPlace([id], new Set(), id) !== null;
  const props = stepProps({ progress: counted ? PROGRESS : "" });
  const Step = STEP_COMPONENT[id];
  // The flow draws every step on its sky.
  await renderWithTheme(
    <SkyBackground>
      <Step {...props} />
    </SkyBackground>
  );
  await flush();
  return props;
};
/** The heading view is the header that speaks the title with the count. */
const expectHeading = (props: StepProps, titleKey: string) => {
  const name = props.progress
    ? t("a11y.join", { first: t(titleKey), second: props.progress })
    : t(titleKey);
  expect(screen.getByRole("header", { name })).toBeOnTheScreen();
  // The flow focuses this view, so it is the header itself, not a wrapper.
  const view = props.headingRef.current as unknown as { props: ViewProps } | null;
  expect(view?.props.accessibilityRole).toBe("header");
  expect([undefined, name]).toContain(view?.props.accessibilityLabel);
};
/** Every alarm item the device has, granted or not; set in the app. */
const alarmItems = (granted: boolean, canRequestInApp: boolean): AlarmPermission[] =>
  [ALARM_PERMISSION.NOTIFICATIONS, ALARM_PERMISSION.EXACT_ALARM].map((id) => ({
    id,
    granted,
    canRequestInApp,
  }));

beforeEach(async () => {
  jest.useFakeTimers();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  mockAlarmItems = alarmItems(false, false);
  jest.mocked(requestLocationPermission).mockResolvedValue({ granted: false });
  useAppStore.setState({ locale: AppLocale.EN });
  useAlarmSettingsStore.setState(useAlarmSettingsStore.getInitialState());
  useLocationStore.setState({
    locationMode: LocationMode.MANUAL,
    initializeLocation: () => Promise.resolve(),
  });
  usePrayerTimesStore.setState({
    todayTimings: RIYADH_DAY,
    usingDefaultLocation: false,
    loadPrayerTimes: () => never(),
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe.each(Object.values(S))("the %s step", (id) => {
  it("speaks its title with the count from its heading view", async () => {
    const props = await renderStep(id);

    expectHeading(props, TITLE_KEY[id]);
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderStep(id);

    expect(controlProblems()).toEqual([]);
  });
});

/** The views a step reaches from its first: the way there, and the heading. */
const VIEWS: [string, OnboardingStepId, (props: StepProps) => Promise<void>, string][] = [
  [
    "the location step's picker",
    S.LOCATION,
    async (props) => {
      await user.press(
        screen.getByRole("radio", { name: new RegExp(t("onboarding.location.city")) })
      );
      await act(async () => lastPrimary(props.setPrimary)?.onPress());
    },
    "location.picker.title",
  ],
  [
    "the location step's coordinates",
    S.LOCATION,
    async (props) => {
      await user.press(
        screen.getByRole("radio", { name: new RegExp(t("onboarding.location.city")) })
      );
      await act(async () => lastPrimary(props.setPrimary)?.onPress());
      await user.press(screen.getByRole("button", { name: t("location.picker.enterCoordinates") }));
    },
    "location.coordinates.title",
  ],
  [
    "the prime's denial",
    S.LOCATION_PERMISSION,
    async (props) => {
      await act(async () => lastPrimary(props.setPrimary)?.onPress());
    },
    "onboarding.locationPermission.title",
  ],
  [
    "the prime's picker",
    S.LOCATION_PERMISSION,
    async (props) => {
      await act(async () => lastPrimary(props.setPrimary)?.onPress());
      await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
    },
    "location.picker.title",
  ],
  [
    "the fetch's error",
    S.FETCH,
    async () => {
      await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));
    },
    "today.failed.title",
  ],
  [
    "the fetch's picker",
    S.FETCH,
    async () => {
      await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
    },
    "location.picker.title",
  ],
  [
    "the alarm's sequence",
    S.FAJR_ALARM,
    async () => {
      await user.press(screen.getByTestId(ONBOARDING_PART.ALARM_TURN_ON));
      await flush();
    },
    "onboarding.alarm.sequence",
  ],
  [
    "the alarm's result when it cannot ring",
    S.FAJR_ALARM,
    async () => {
      mockAlarmItems = alarmItems(false, true);
      await user.press(screen.getByTestId(ONBOARDING_PART.ALARM_TURN_ON));
      await flush();
    },
    "onboarding.alarm.fajr.title",
  ],
];

describe.each(VIEWS)("%s", (_, id, open, titleKey) => {
  beforeEach(() => {
    // The fetch has no stored day, and its fix fails, so it reaches its error.
    if (id !== S.FETCH) return;
    usePrayerTimesStore.setState({ todayTimings: null });
    useLocationStore.setState({
      locationMode: LocationMode.DEVICE,
      initializeLocation: () => Promise.reject(new Error("timeout")),
    });
    jest.spyOn(AppLogger.create("prayertimes"), "w").mockImplementation(() => {});
  });

  it("speaks its own title with the count, and every control is reachable", async () => {
    const props = await renderStep(id);

    await open(props);

    expectHeading(props, titleKey);
    expect(controlProblems()).toEqual([]);
  });
});

/** The real controls the city list and coordinate entry draw, by heading. */
const PICKER_CONTROLS: Record<string, () => RegExp[]> = {
  "location.picker.title": () => [
    new RegExp(mockCity.name),
    new RegExp(`^${t("location.picker.enterCoordinates")}$`),
  ],
  "location.coordinates.title": () => [new RegExp(`^${t("a11y.location.coordinates.save")}$`)],
};
/** Whether a view sits inside a scroll view. */
const scrolls = (element: { type: unknown; parent: unknown } | null): boolean =>
  element !== null &&
  (element.type === "RCTScrollView" ||
    scrolls(element.parent as { type: unknown; parent: unknown } | null));

// The control check above runs over these, so they must be drawn.
describe.each(VIEWS.filter(([, , , titleKey]) => titleKey in PICKER_CONTROLS))(
  "%s",
  (_, id, open, titleKey) => {
    it("draws the real list or entry controls", async () => {
      const props = await renderStep(id);

      await open(props);

      for (const name of PICKER_CONTROLS[titleKey]()) {
        expect(screen.getByRole("button", { name })).toBeOnTheScreen();
      }
    });
  }
);

// Coordinate entry grows with the text size, so Save must stay reachable.
it("draws coordinate entry inside a scroll view", async () => {
  const [, id, open] = VIEWS.find(([, , , titleKey]) => titleKey === "location.coordinates.title")!;
  const props = await renderStep(id);
  await open(props);

  const save = screen.getByRole("button", { name: t("a11y.location.coordinates.save") });
  expect(scrolls(save as unknown as { type: unknown; parent: unknown })).toBe(true);
});

// The registry draws each alarm id with its own alarm.
it.each([
  [S.FAJR_ALARM, ALARM_TYPE.FAJR, ALARM_TYPE.FRIDAY],
  [S.FRIDAY_ALARM, ALARM_TYPE.FRIDAY, ALARM_TYPE.FAJR],
])("the %s step turns on its own alarm", async (id, own, other) => {
  mockAlarmItems = alarmItems(true, true);
  await renderStep(id);

  await user.press(screen.getByTestId(ONBOARDING_PART.ALARM_TURN_ON));
  await flush();

  const alarms = useAlarmSettingsStore.getState();
  expect(alarms[own].enabled).toBe(true);
  expect(alarms[other].enabled).toBe(false);
});
