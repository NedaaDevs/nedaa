// The real column hook: steps that change its inputs, then advance.
import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import { PermissionStatus } from "expo-notifications";

import { OnboardingFlow } from "@/components/onboarding/flow/OnboardingFlow";
import { WelcomeStep } from "@/components/onboarding/flow/steps/WelcomeStep";
import { ALARM_TYPE } from "@/constants/Alarm";
import { APP_STATE } from "@/constants/AppState";
import { E2E_ID } from "@/constants/E2E";
import {
  LOCATION_CHOICE,
  ONBOARDING_PART,
  ONBOARDING_STEP as S,
  STEP_LOCK_MS,
} from "@/constants/Onboarding";
import { AppLocale } from "@/enums/app";
import { LocationMode } from "@/enums/location";
import i18n from "@/localization/i18n";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { captureAppState, emitAppState } from "@/test-helpers/appStateMock";
import { columnFor } from "@/test-helpers/onboardingColumn";
import {
  currentStep,
  propsOf,
  realSteps,
  resetStepStubs,
  STEP_STUB_PREFIX,
  stubMounts,
} from "@/test-helpers/onboardingStepStubs";
import { RIYADH_DAY } from "@/test-helpers/prayerDay";
import { renderWithTheme } from "@/test-helpers/theme";
import { alarmSupport } from "@/utils/alarmSupport";
import { checkLocationPermission } from "@/utils/location";
import { checkPermissions } from "@/utils/notifications";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/services/databases", () => ({ initDatabases: () => Promise.resolve() }));
jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  checkLocationPermission: jest.fn(),
}));
jest.mock("@/utils/notifications", () => ({
  ...jest.requireActual("@/utils/notifications"),
  checkPermissions: jest.fn(),
}));
jest.mock("@/utils/alarmSupport", () => ({ alarmSupport: jest.fn() }));

const t = i18n.t.bind(i18n);

jest.mock("@/components/ui/sky-background", () => {
  const { createElement: h, Fragment } = jest.requireActual("react");
  return {
    ...jest.requireActual("@/components/ui/sky-background"),
    SkyBackground: ({ children }: { children?: unknown }) => h(Fragment, null, children),
  };
});
jest.mock("@/components/onboarding/flow/steps", () =>
  jest.requireActual("@/test-helpers/onboardingStepStubs")
);

const mockGrants = { location: false, notifications: false };
let mockNow = 0;

const renderFlow = async () => {
  await renderWithTheme(<OnboardingFlow />);
  await screen.findByTestId(new RegExp(`^${STEP_STUB_PREFIX}`));
};
/** An iOS system prompt closing: the app goes inactive, then active. */
const returnToApp = async () => {
  mockNow += STEP_LOCK_MS;
  await act(async () => emitAppState(APP_STATE.INACTIVE, APP_STATE.ACTIVE));
};

describe("OnboardingFlow with the real column", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage(AppLocale.EN));
    mockGrants.location = false;
    mockGrants.notifications = false;
    mockNow = 1_000;
    jest.spyOn(Date, "now").mockImplementation(() => mockNow);
    captureAppState();
    jest
      .mocked(checkLocationPermission)
      .mockImplementation(async () => ({ granted: mockGrants.location, canAskAgain: true }));
    jest.mocked(checkPermissions).mockImplementation(async () => ({
      status: mockGrants.notifications ? PermissionStatus.GRANTED : PermissionStatus.UNDETERMINED,
    }));
    jest.mocked(alarmSupport).mockResolvedValue(true);
    useAppStore.setState({ isFirstRun: true, onboardingStep: null, locale: AppLocale.EN });
    useLocationStore.setState({
      locationMode: LocationMode.DEVICE,
      manualLocation: null,
      lastKnownCoords: null,
    });
    usePrayerTimesStore.setState({
      todayTimings: null,
      usingDefaultLocation: false,
      // The stored days are today's: the roll at the start keeps them.
      refreshTimingsFromDb: async () => [],
    });
    useAlarmSettingsStore.setState(useAlarmSettingsStore.getInitialState());
    resetStepStubs();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("counts a session change made before onNext: the language step is inserted", async () => {
    await renderFlow();

    await act(async () => {
      propsOf(S.WELCOME).setSession({ languageRequested: true });
      propsOf(S.WELCOME).onNext();
    });

    expect(currentStep()).toBe(S.LANGUAGE);
  });

  // The language list was only visited: Get Started withdraws the request.
  it("Get Started after a language visit goes to the first counted page, not the list", async () => {
    realSteps.set(S.WELCOME, WelcomeStep);
    await renderFlow();

    await userEvent.press(screen.getByRole("link"));
    expect(currentStep()).toBe(S.LANGUAGE);
    mockNow += STEP_LOCK_MS;
    await userEvent.press(screen.getByTestId(ONBOARDING_PART.BACK));
    expect(currentStep()).toBe(S.WELCOME);

    await userEvent.press(screen.getByTestId(E2E_ID.ONBOARDING_GET_STARTED));

    expect(currentStep()).toBe(S.NUMERALS);
  });

  // Welcome is uncounted, so the language step it inserts reads "1 of N".
  it("counts the inserted language step as the first page, over the column less Welcome and Completion", async () => {
    await renderFlow();

    await act(async () => {
      propsOf(S.WELCOME).setSession({ languageRequested: true });
      propsOf(S.WELCOME).onNext();
    });

    const column = columnFor({ languageRequested: true });
    expect(
      screen.getByTestId(ONBOARDING_PART.PROGRESS, { includeHiddenElements: true })
    ).toHaveTextContent(t("onboarding.progress", { current: 1, total: column.length - 2 }));
  });

  it("automatic location leads to the prime, and its grant to the fetch", async () => {
    useAppStore.setState({ onboardingStep: S.LOCATION });
    await renderFlow();

    await act(async () => {
      propsOf(S.LOCATION).setSession({ locationChoice: LOCATION_CHOICE.AUTOMATIC });
      propsOf(S.LOCATION).onNext();
    });
    expect(currentStep()).toBe(S.LOCATION_PERMISSION);

    await act(async () => {
      propsOf(S.LOCATION_PERMISSION).setSession({ locationGranted: true });
      propsOf(S.LOCATION_PERMISSION).onNext();
    });
    expect(currentStep()).toBe(S.FETCH);
  });

  it("a city stored by the picker keeps the location step until it reports", async () => {
    useAppStore.setState({ onboardingStep: S.LOCATION });
    await renderFlow();

    await act(async () => usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY }));
    expect(currentStep()).toBe(S.LOCATION);

    await act(async () => {
      propsOf(S.LOCATION).setSession({ locationChoice: LOCATION_CHOICE.CITY });
      propsOf(S.LOCATION).onNext();
    });
    expect(currentStep()).toBe(S.CALCULATION);
  });

  it("a return from an iOS prompt during the request neither skips nor freezes the flow", async () => {
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
    useAppStore.setState({ onboardingStep: S.NOTIFICATIONS });
    await renderFlow();
    const asking = propsOf(S.NOTIFICATIONS);
    await act(async () => asking.setBusy(true));

    mockGrants.notifications = true;
    await returnToApp();
    await waitFor(() => expect(currentStep()).toBe(S.FAJR_ALARM));

    await act(async () => {
      asking.setBusy(false);
      asking.onNext();
    });
    expect(currentStep()).toBe(S.FAJR_ALARM);

    mockNow += STEP_LOCK_MS;
    await userEvent.press(screen.getByTestId(ONBOARDING_PART.CONTINUE));
    expect(currentStep()).toBe(S.FRIDAY_ALARM);
  });

  it("a failed permission read counts as not granted, so the flow still opens", async () => {
    jest.mocked(checkPermissions).mockRejectedValue(new Error("permission read failed"));
    useAppStore.setState({ onboardingStep: S.NOTIFICATIONS });
    await renderFlow();

    expect(currentStep()).toBe(S.NOTIFICATIONS);
  });

  it("turning an alarm on keeps its step", async () => {
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
    useAppStore.setState({ onboardingStep: S.FAJR_ALARM });
    await renderFlow();

    await act(async () => useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true));

    expect(currentStep()).toBe(S.FAJR_ALARM);
  });

  it("offers no alarm step where alarms cannot ring", async () => {
    jest.mocked(alarmSupport).mockResolvedValue(false);
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
    useAppStore.setState({ onboardingStep: S.FAJR_ALARM });
    await renderFlow();

    expect(currentStep()).toBe(S.COMPLETE);
  });

  it("offers no alarm step at the default location's times", async () => {
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY, usingDefaultLocation: true });
    useAppStore.setState({ onboardingStep: S.FAJR_ALARM });
    await renderFlow();

    expect(currentStep()).toBe(S.COMPLETE);
  });

  it("keeps the alarm step the user is on when a later AlarmKit read says no", async () => {
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
    useAppStore.setState({ onboardingStep: S.FAJR_ALARM });
    await renderFlow();
    expect(currentStep()).toBe(S.FAJR_ALARM);
    jest.mocked(alarmSupport).mockClear().mockResolvedValue(false);

    await returnToApp();
    await waitFor(() => expect(alarmSupport).toHaveBeenCalledTimes(1));

    expect(currentStep()).toBe(S.FAJR_ALARM);
    expect(stubMounts[S.FAJR_ALARM]).toBe(1);
  });

  // After a kill, a granted location stands in for the automatic choice.
  it("resumes mid-fetch on the automatic path at the fetch", async () => {
    mockGrants.location = true;
    useAppStore.setState({ onboardingStep: S.FETCH });
    await renderFlow();

    expect(currentStep()).toBe(S.FETCH);
  });

  it("the fetch keeps its place while it stores the day, then back skips it", async () => {
    mockGrants.location = true;
    useAppStore.setState({ onboardingStep: S.FETCH });
    await renderFlow();

    await act(async () => propsOf(S.FETCH).setSession({ fetchStarted: true }));
    await act(async () => usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY }));
    expect(currentStep()).toBe(S.FETCH);
    expect(stubMounts[S.FETCH]).toBe(1);

    await act(async () => propsOf(S.FETCH).onNext());
    expect(currentStep()).toBe(S.CALCULATION);

    mockNow += STEP_LOCK_MS;
    await userEvent.press(screen.getByTestId(ONBOARDING_PART.BACK));
    expect(currentStep()).toBe(S.LOCATION);
  });

  // A kill on the prime, before the answer, resumes on the prime.
  it("resumes on the location prime with the automatic choice kept", async () => {
    useAppStore.setState({ onboardingStep: S.LOCATION_PERMISSION });
    await renderFlow();

    expect(currentStep()).toBe(S.LOCATION_PERMISSION);
  });

  it("resumes past the prime once a city is stored", async () => {
    useLocationStore.setState({ lastKnownCoords: { latitude: 21.4, longitude: 39.8 } });
    useAppStore.setState({ onboardingStep: S.LOCATION_PERMISSION });
    await renderFlow();

    expect(currentStep()).toBe(S.FETCH);
  });

  // A city that lands after the user skipped on must not pull them back.
  it("stays put when a city lands after the user skipped past the location step", async () => {
    useAppStore.setState({ onboardingStep: S.LOCATION });
    await renderFlow();
    const location = propsOf(S.LOCATION);
    mockNow += STEP_LOCK_MS;
    await userEvent.press(screen.getByTestId(ONBOARDING_PART.SKIP));
    expect(currentStep()).toBe(S.NOTIFICATIONS);

    await act(async () => usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY }));
    await act(async () => {
      location.setSession({ locationChoice: LOCATION_CHOICE.CITY });
      location.onNext();
    });

    expect(currentStep()).toBe(S.NOTIFICATIONS);
  });

  // The pick takes the location step out; the fetch that has run is passed.
  it("passes a settled fetch when a city pick takes the location step out", async () => {
    mockGrants.location = true;
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
    useAppStore.setState({ onboardingStep: S.LOCATION });
    await renderFlow();
    await act(async () => propsOf(S.LOCATION).setSession({ fetchStarted: true }));
    expect(currentStep()).toBe(S.LOCATION);

    await act(async () => {
      propsOf(S.LOCATION).setSession({ locationChoice: LOCATION_CHOICE.CITY });
      propsOf(S.LOCATION).onNext();
    });

    expect(currentStep()).toBe(S.CALCULATION);
    expect(stubMounts[S.FETCH]).toBeUndefined();
  });
});
