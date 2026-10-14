// The real flow and steps: a step's sub-view owns the frame's back and primary.
import { BackHandler } from "react-native";
import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";

import { OnboardingFlow } from "@/components/onboarding/flow/OnboardingFlow";
import {
  ONBOARDING_PART,
  ONBOARDING_STEP as S,
  type OnboardingStepId,
} from "@/constants/Onboarding";
import { AppLocale } from "@/enums/app";
import { LocationMode } from "@/enums/location";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { never } from "@/test-helpers/promises";
import { renderWithTheme } from "@/test-helpers/theme";
import type { ManualLocation } from "@/types/location";
import { requestLocationPermission } from "@/utils/location";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/services/databases", () => ({ initDatabases: () => Promise.resolve() }));
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => Promise.resolve(null) }));
jest.mock("@/utils/date", () => jest.requireActual("@/test-helpers/hijriDateMock"));
jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  requestLocationPermission: jest.fn(),
}));

const mockPicker: { onEnterCoordinates?: () => void } = {};
jest.mock("@/components/location/CityPicker", () => {
  const CityPickerStub = (props: { onEnterCoordinates?: () => void }) => {
    mockPicker.onEnterCoordinates = props.onEnterCoordinates;
    return null;
  };
  return { __esModule: true, default: CityPickerStub };
});
jest.mock("@/components/location/CoordinateEntry", () => ({
  __esModule: true,
  default: () => null,
}));

const COLUMN: OnboardingStepId[] = [
  S.WELCOME,
  S.TEXT_SIZE,
  S.LOCATION,
  S.LOCATION_PERMISSION,
  S.FETCH,
  S.NOTIFICATIONS,
  S.COMPLETE,
];
let mockColumn = COLUMN;
jest.mock("@/components/onboarding/flow/useOnboardingColumn", () => ({
  ...jest.requireActual("@/components/onboarding/flow/useOnboardingColumn"),
  useOnboardingColumn: () => mockColumn,
}));

const t = i18n.t.bind(i18n);
const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
const handlers: (() => boolean | null | undefined)[] = [];

const continueShown = () => screen.queryByTestId(ONBOARDING_PART.CONTINUE) !== null;
const heading = (key: string) => screen.getByRole("header", { name: new RegExp(t(key)) });
const pressFrameBack = () => user.press(screen.getByTestId(ONBOARDING_PART.BACK));
const pressHardwareBack = () => act(async () => void handlers.at(-1)?.());
const escape = () =>
  act(async () => {
    fireEvent(screen.getByTestId(ONBOARDING_PART.FRAME), "accessibilityEscape");
  });
const renderAt = async (step: OnboardingStepId) => {
  useAppStore.setState({ onboardingStep: step });
  await renderWithTheme(<OnboardingFlow />);
};

/** Opens each host's city picker from the step's first view. */
const OPEN_PICKER = {
  [S.LOCATION]: async () => {
    await user.press(
      screen.getByRole("radio", { name: new RegExp(t("onboarding.location.city")) })
    );
    await user.press(screen.getByTestId(ONBOARDING_PART.CONTINUE));
  },
  [S.LOCATION_PERMISSION]: async () => {
    await user.press(screen.getByTestId(ONBOARDING_PART.CONTINUE));
    await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
  },
  [S.FETCH]: async () => {
    await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
  },
} satisfies Partial<Record<OnboardingStepId, () => Promise<void>>>;
const PICKER_HOSTS = Object.keys(OPEN_PICKER) as (keyof typeof OPEN_PICKER)[];

beforeEach(async () => {
  jest.useFakeTimers();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  delete mockPicker.onEnterCoordinates;
  jest.mocked(requestLocationPermission).mockResolvedValue({ granted: false });
  handlers.length = 0;
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
    handlers.push(handler as () => boolean | null | undefined);
    return { remove: () => {} };
  });
  useAppStore.setState({ isFirstRun: true, locale: AppLocale.EN });
  mockColumn = COLUMN;
  // The fetch waits on a load that never answers: it stays on its loading view.
  useLocationStore.setState({
    locationMode: LocationMode.MANUAL,
    manualLocation: null,
    manualLocationChosenAt: null,
    initializeLocation: () => never(),
  });
  usePrayerTimesStore.setState({
    todayTimings: null,
    usingDefaultLocation: false,
    loadPrayerTimesAtCurrentPlace: () => never(),
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it.each(PICKER_HOSTS)(
  "draws no Continue while the %s step's city picker shows; Skip stays",
  async (step) => {
    await renderAt(step);

    await OPEN_PICKER[step]();

    expect(heading("location.picker.title")).toBeOnTheScreen();
    expect(continueShown()).toBe(false);
    expect(screen.getByTestId(ONBOARDING_PART.SKIP)).toBeOnTheScreen();
  }
);

it("walks back out of the sub-views on each trigger, then to the previous step", async () => {
  await renderAt(S.LOCATION);
  await OPEN_PICKER[S.LOCATION]();
  await act(async () => mockPicker.onEnterCoordinates?.());
  expect(heading("location.coordinates.title")).toBeOnTheScreen();

  await pressFrameBack();
  expect(heading("location.picker.title")).toBeOnTheScreen();

  await pressHardwareBack();
  expect(heading("onboarding.location.question")).toBeOnTheScreen();
  expect(continueShown()).toBe(true);

  await escape();
  expect(heading("onboarding.textSize.chooseTitle")).toBeOnTheScreen();
});

it("returns the fetch's picker to a new load, with no Continue", async () => {
  await renderAt(S.FETCH);
  await OPEN_PICKER[S.FETCH]();

  await pressFrameBack();

  expect(heading("onboarding.fetch.title")).toBeOnTheScreen();
  expect(continueShown()).toBe(false);
});

it("returns the prime's picker to its denial, where Continue moves on", async () => {
  await renderAt(S.LOCATION_PERMISSION);
  await OPEN_PICKER[S.LOCATION_PERMISSION]();

  await pressFrameBack();

  expect(screen.getByText(t("onboarding.location.deniedBody"))).toBeOnTheScreen();
  expect(continueShown()).toBe(true);
});

describe("leaving the fetch's picker on the automatic path", () => {
  const MECCA: ManualLocation = {
    cityId: 1,
    name: "Mecca",
    names: { ar: null, ur: null, ms: null },
    region: null,
    countryCode: "SA",
    country: { name: "Saudi Arabia", names: { ar: null, ur: null, ms: null } },
    latitude: 21.4,
    longitude: 39.8,
    timezone: "Asia/Riyadh",
  };
  /** A resume on the prime keeps automatic; with no prime it lands on fetch. */
  const resumeAtFetch = () => {
    mockColumn = COLUMN.filter((id) => id !== S.LOCATION_PERMISSION);
    return renderAt(S.LOCATION_PERMISSION);
  };
  const cityKept = () => useLocationStore.getState().manualLocation !== null;

  it("keeps a city stored before the run", async () => {
    useLocationStore.setState({ manualLocation: MECCA, manualLocationChosenAt: Date.now() - 1 });
    await resumeAtFetch();
    expect(heading("onboarding.fetch.title")).toBeOnTheScreen();
    await OPEN_PICKER[S.FETCH]();

    await pressFrameBack();

    expect(cityKept()).toBe(true);
    expect(useLocationStore.getState().locationMode).toBe(LocationMode.MANUAL);
  });

  it("drops a city tried in this run", async () => {
    await resumeAtFetch();
    await OPEN_PICKER[S.FETCH]();
    // A pick there stored its city, then its times failed to load.
    useLocationStore.setState({ manualLocation: MECCA, manualLocationChosenAt: Date.now() });

    await pressFrameBack();

    expect(cityKept()).toBe(false);
    expect(useLocationStore.getState().locationMode).toBe(LocationMode.DEVICE);
  });
});
