import { Activity } from "react";
import { AccessibilityInfo } from "react-native";
import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

import { FetchStep } from "@/components/onboarding/flow/steps/FetchStep";
import { NEW_SESSION, type StepProps } from "@/components/onboarding/flow/types";
import {
  FETCH_ATTEMPT_TIMEOUT_MS,
  FETCH_RETRY_MS,
  LOCATION_CHOICE,
  ONBOARDING_PART,
  PREVIEW_MOTION,
} from "@/constants/Onboarding";
import { AppLocale } from "@/enums/app";
import { LocationMode } from "@/enums/location";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import {
  lastBack,
  lastPrimary,
  primaryHidden,
  stepProps,
} from "@/test-helpers/onboardingStepProps";
import { RIYADH_DAY } from "@/test-helpers/prayerDay";
import { later, never } from "@/test-helpers/promises";
import { renderWithTheme } from "@/test-helpers/theme";
import { E2E_ID } from "@/constants/E2E";
import { LOCATION_FAILURE } from "@/constants/Location";
import { AppLogger } from "@/utils/appLogger";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/utils/date", () => jest.requireActual("@/test-helpers/hijriDateMock"));
const mockOpen = jest.fn(async () => {});
jest.mock("@/services/databases", () => ({ initDatabases: () => mockOpen() }));

const mockPicker: { onDone?: () => void; onEnterCoordinates?: () => void } = {};
jest.mock("@/components/location/CityPicker", () => {
  const CityPickerStub = (props: { onDone: () => void; onEnterCoordinates?: () => void }) => {
    mockPicker.onDone = props.onDone;
    mockPicker.onEnterCoordinates = props.onEnterCoordinates;
    return null;
  };
  return { __esModule: true, default: CityPickerStub };
});
const mockCoordinates: { onDone?: () => void } = {};
jest.mock("@/components/location/CoordinateEntry", () => {
  const CoordinateEntryStub = (props: { onDone: () => void }) => {
    mockCoordinates.onDone = props.onDone;
    return null;
  };
  return { __esModule: true, default: CoordinateEntryStub };
});

const t = i18n.t.bind(i18n);
const CITY = { locationChoice: LOCATION_CHOICE.CITY };

const mockFix = jest.fn(async () => {});
const mockLoad = jest.fn(async (_force?: boolean) => {});
/** A fetch that lands: the store gets the day for a verified place. */
const fetchLands = () =>
  mockLoad.mockImplementation(async () => {
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY, usingDefaultLocation: false });
  });
/** Runs the pending promise chain without moving the clock. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(0));
const silencedWarn = () =>
  jest.spyOn(AppLogger.create("prayertimes"), "w").mockImplementation(() => {});
/** The offer's Retry, drawn in place of the frame's primary. */
const pressRetry = () =>
  act(async () => {
    await userEvent.press(screen.getByRole("button", { name: t("common.retry") }));
  });
/** The error offer's city row, read with its note. */
const OFFER_CITY_NAME = () =>
  t("a11y.join", {
    first: t("onboarding.location.chooseCity"),
    second: t("location.failure.chooseCityNote"),
  });

beforeEach(async () => {
  jest.useFakeTimers();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  mockOpen.mockReset().mockResolvedValue(undefined);
  mockFix.mockReset().mockResolvedValue(undefined);
  mockLoad.mockReset().mockResolvedValue(undefined);
  delete mockPicker.onDone;
  delete mockPicker.onEnterCoordinates;
  delete mockCoordinates.onDone;
  useLocationStore.setState({
    locationMode: LocationMode.DEVICE,
    localizedLocation: { country: "", city: "" },
    initializeLocation: mockFix,
  });
  usePrayerTimesStore.setState({
    todayTimings: null,
    usingDefaultLocation: false,
    loadPrayerTimesAtCurrentPlace: mockLoad,
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("takes the fix first: a failed fix never fetches, retries once after the delay, then shows the error", async () => {
  silencedWarn();
  mockFix.mockRejectedValue(new Error("timeout"));
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);
  await settle();
  expect(mockFix).toHaveBeenCalledTimes(1);
  expect(mockLoad).not.toHaveBeenCalled();

  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS - 1));
  expect(mockFix).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(t("onboarding.fetch.errorTitle"))).toBeNull();

  await act(() => jest.advanceTimersByTimeAsync(1));
  expect(mockFix).toHaveBeenCalledTimes(2);
  expect(screen.getByText(t("onboarding.fetch.errorTitle"))).toBeTruthy();
  expect(props.setBusy).not.toHaveBeenCalledWith(true);
  expect(props.onNext).not.toHaveBeenCalled();

  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS * 5));
  expect(mockFix).toHaveBeenCalledTimes(2);
});

it("logs a failed attempt instead of showing it", async () => {
  const warn = silencedWarn();
  mockFix.mockRejectedValue(new Error("timeout"));
  await renderWithTheme(<FetchStep {...stepProps()} />);
  await settle();

  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith("Onboarding", expect.stringContaining("timeout"));
  expect(screen.queryByText(t("onboarding.fetch.errorTitle"))).toBeNull();
});

it("ends in the error state, not a spinner, when the databases cannot open", async () => {
  silencedWarn();
  mockOpen.mockRejectedValue(new Error("open failed"));
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);

  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

  expect(mockOpen).toHaveBeenCalledTimes(2);
  expect(mockFix).not.toHaveBeenCalled();
  expect(mockLoad).not.toHaveBeenCalled();
  expect(screen.getByText(t("onboarding.fetch.errorTitle"))).toBeTruthy();
  expect(props.onNext).not.toHaveBeenCalled();
});

it("treats times for the default place as a failure", async () => {
  silencedWarn();
  useLocationStore.setState({ locationMode: LocationMode.MANUAL });
  mockLoad.mockImplementation(async () => {
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY, usingDefaultLocation: true });
  });
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);

  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

  expect(mockFix).not.toHaveBeenCalled();
  expect(mockLoad).toHaveBeenCalledTimes(2);
  expect(screen.getByText(t("onboarding.fetch.errorTitle"))).toBeTruthy();
  expect(props.onNext).not.toHaveBeenCalled();
});

it("keeps its place before the day is stored, forces the fetch, then moves on", async () => {
  fetchLands();
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);

  await waitFor(() => expect(props.onNext).toHaveBeenCalledTimes(1));
  expect(props.setSession).toHaveBeenCalledWith({ fetchStarted: true });
  expect(jest.mocked(props.setSession).mock.invocationCallOrder[0]).toBeLessThan(
    mockLoad.mock.invocationCallOrder[0]
  );
  expect(mockLoad).toHaveBeenCalledWith(true);
});

// The step has just read the fix; the load must not read the position again.
it("loads at the place it holds, after its own fix in automatic mode only", async () => {
  fetchLands();
  const props = stepProps();
  const view = await renderWithTheme(<FetchStep {...props} />);
  await settle();
  expect(mockLoad).toHaveBeenLastCalledWith(true);
  await view.unmount();

  useLocationStore.setState({ locationMode: LocationMode.MANUAL });
  usePrayerTimesStore.setState({ todayTimings: null });
  await renderWithTheme(<FetchStep {...stepProps()} />);
  await settle();

  expect(mockFix).toHaveBeenCalledTimes(1);
  expect(mockLoad).toHaveBeenCalledTimes(2);
  expect(mockLoad).toHaveBeenLastCalledWith(true);
});

it("does not fetch a day already stored", async () => {
  usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);
  await settle();

  expect(props.onNext).toHaveBeenCalledTimes(1);
  expect(mockOpen).not.toHaveBeenCalled();
  expect(mockFix).not.toHaveBeenCalled();
  expect(mockLoad).not.toHaveBeenCalled();
});

it("fetches once when its effects run again mid-fetch and when it re-renders", async () => {
  const fix = later();
  mockFix.mockReturnValue(fix.promise);
  fetchLands();
  const props = stepProps();
  const shown = (mode: "visible" | "hidden") => (
    <Activity mode={mode}>
      <FetchStep {...props} />
    </Activity>
  );
  const view = await renderWithTheme(shown("visible"));
  await settle();
  // Hiding and showing runs the effects again with the same instance.
  await view.rerender(shown("hidden"));
  await view.rerender(shown("visible"));
  fix.release();
  await settle();

  expect(mockFix).toHaveBeenCalledTimes(1);
  expect(mockLoad).toHaveBeenCalledTimes(1);
  expect(props.onNext).toHaveBeenCalledTimes(1);
});

it("loads no times and does not move on when the step has left mid-fix", async () => {
  const fix = later();
  mockFix.mockReturnValue(fix.promise);
  fetchLands();
  const props = stepProps();
  const view = await renderWithTheme(<FetchStep {...props} />);
  await settle();
  await view.unmount();

  fix.release();
  await settle();

  expect(mockLoad).not.toHaveBeenCalled();
  expect(props.onNext).not.toHaveBeenCalled();
});

it("does not retry once the step has left", async () => {
  const fix = later();
  mockFix.mockReturnValue(fix.promise);
  const props = stepProps();
  const view = await renderWithTheme(<FetchStep {...props} />);
  await settle();
  await view.unmount();

  fix.fail(new Error("timeout"));
  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

  expect(mockFix).toHaveBeenCalledTimes(1);
  expect(mockLoad).not.toHaveBeenCalled();
  expect(props.onNext).not.toHaveBeenCalled();
});

describe("the stage line", () => {
  const locating = () => screen.queryByText(t("onboarding.fetch.locatingDevice"));
  const loadingTimes = () => screen.queryByText(t("onboarding.fetch.loadingTimes"));

  it("shows the chosen city and that the times load in manual mode, through a retry, never locating", async () => {
    silencedWarn();
    const place = { city: "Riyadh", country: "Saudi Arabia" };
    useLocationStore.setState({ locationMode: LocationMode.MANUAL, localizedLocation: place });
    mockLoad.mockRejectedValueOnce(new Error("offline")).mockReturnValue(never());
    await renderWithTheme(<FetchStep {...stepProps()} />);
    expect(locating()).toBeNull();
    await settle();

    expect(screen.getByText(t("place.name", place))).toBeTruthy();
    expect(loadingTimes()).toBeTruthy();
    expect(locating()).toBeNull();

    await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(loadingTimes()).toBeTruthy();
    expect(locating()).toBeNull();
  });

  it("says the city is being found while the fix runs, then that the times load", async () => {
    const fix = later();
    mockFix.mockReturnValue(fix.promise);
    mockLoad.mockReturnValue(never());
    const found = { city: "Jeddah", country: "Saudi Arabia" };
    await renderWithTheme(<FetchStep {...stepProps()} />);
    await settle();
    expect(locating()).toBeTruthy();
    expect(loadingTimes()).toBeNull();

    await act(async () => {
      useLocationStore.setState({ localizedLocation: found });
      fix.release();
    });
    await settle();

    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(locating()).toBeNull();
    expect(loadingTimes()).toBeTruthy();
    expect(screen.getByText(t("place.name", found))).toBeTruthy();
  });

  it("says the city is being found again on the retry after a failed load", async () => {
    silencedWarn();
    mockLoad.mockRejectedValueOnce(new Error("offline")).mockReturnValue(never());
    const fix = later();
    await renderWithTheme(<FetchStep {...stepProps()} />);
    await settle();
    mockFix.mockReturnValue(fix.promise);

    await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));
    expect(mockFix).toHaveBeenCalledTimes(2);
    expect(locating()).toBeTruthy();
    expect(loadingTimes()).toBeNull();
  });

  it("keeps the locating line when a try that lost to the deadline lands its fix during the retry", async () => {
    silencedWarn();
    const lateFix = later();
    mockFix.mockReturnValueOnce(lateFix.promise).mockReturnValue(never());
    await renderWithTheme(<FetchStep {...stepProps()} />);
    await act(() => jest.advanceTimersByTimeAsync(FETCH_ATTEMPT_TIMEOUT_MS + FETCH_RETRY_MS));
    expect(mockFix).toHaveBeenCalledTimes(2);

    lateFix.release();
    await settle();

    expect(mockLoad).not.toHaveBeenCalled();
    expect(locating()).toBeTruthy();
    expect(loadingTimes()).toBeNull();
  });
});

it("shows the loading heading, body, locating line and a pulsing preview while the fix is pending", async () => {
  mockFix.mockReturnValue(never());
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);
  await settle();

  expect(screen.getByText(t("onboarding.fetch.title"))).toBeTruthy();
  expect(screen.getByText(t("onboarding.fetch.body"))).toBeTruthy();
  expect(screen.getByText(t("onboarding.fetch.locatingDevice"))).toBeTruthy();
  expect(screen.getByTestId(ONBOARDING_PART.PREVIEW_TIMES)).toHaveStyle({
    opacity: PREVIEW_MOTION.PULSE_OPACITY,
  });
  expect(lastPrimary(props.setPrimary)).toBeNull();
});

// Skip and Back stay open: a fetch that never answers must not trap the reader.
it("never holds the flow busy and draws no frame primary while loading", async () => {
  mockFix.mockReturnValue(never());
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);
  await settle();

  expect(props.setBusy).not.toHaveBeenCalledWith(true);
  expect(jest.mocked(props.setPrimaryHidden).mock.lastCall).toEqual([true]);
});

it("gives up on an attempt with no answer within the deadline, then shows the error after the retry", async () => {
  const warn = silencedWarn();
  useLocationStore.setState({ locationMode: LocationMode.MANUAL });
  mockLoad.mockReturnValue(never());
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);
  const worstCase = 2 * FETCH_ATTEMPT_TIMEOUT_MS + FETCH_RETRY_MS;

  await act(() => jest.advanceTimersByTimeAsync(worstCase - 1));
  expect(mockLoad).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(t("onboarding.fetch.errorTitle"))).toBeNull();

  await act(() => jest.advanceTimersByTimeAsync(1));
  expect(screen.getByText(t("onboarding.fetch.errorTitle"))).toBeTruthy();
  expect(warn).toHaveBeenCalledTimes(2);
  expect(props.setBusy).not.toHaveBeenCalledWith(true);
  expect(props.onNext).not.toHaveBeenCalled();
});

it("clears the deadline once an attempt lands", async () => {
  const set = jest.spyOn(global, "setTimeout");
  const clear = jest.spyOn(global, "clearTimeout");
  fetchLands();
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);
  await settle();

  const deadline = set.mock.calls.findIndex(([, ms]) => ms === FETCH_ATTEMPT_TIMEOUT_MS);
  expect(deadline).toBeGreaterThanOrEqual(0);
  expect(clear).toHaveBeenCalledWith(set.mock.results[deadline]?.value);
  expect(props.onNext).toHaveBeenCalledTimes(1);
});

it("loads nothing once a city is picked mid-fix, and the picked city stays", async () => {
  const fix = later();
  mockFix.mockReturnValue(fix.promise);
  fetchLands();
  const picked = { city: "Lahore", country: "Pakistan" };
  const props = stepProps();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderWithTheme(<FetchStep {...props} />);
  await settle();

  await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
  useLocationStore.setState({ locationMode: LocationMode.MANUAL, localizedLocation: picked });
  await act(async () => mockPicker.onDone?.());
  fix.release();
  await act(() => jest.advanceTimersByTimeAsync(FETCH_ATTEMPT_TIMEOUT_MS));

  expect(mockLoad).not.toHaveBeenCalled();
  expect(useLocationStore.getState().localizedLocation).toEqual(picked);
  expect(props.onNext).toHaveBeenCalledTimes(1);
});

it("does not log the failure of a try abandoned for the picker", async () => {
  const warn = silencedWarn();
  const fix = later();
  mockFix.mockReturnValue(fix.promise);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderWithTheme(<FetchStep {...stepProps()} />);
  await settle();

  await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
  fix.fail(new Error("timeout"));
  await settle();

  expect(warn).not.toHaveBeenCalled();
});

it("loads nothing from a try that lost to the deadline when its fix lands during the retry", async () => {
  silencedWarn();
  const lateFix = later();
  mockFix.mockReturnValueOnce(lateFix.promise);
  mockLoad.mockReturnValue(never());
  await renderWithTheme(<FetchStep {...stepProps()} />);

  await act(() => jest.advanceTimersByTimeAsync(FETCH_ATTEMPT_TIMEOUT_MS + FETCH_RETRY_MS));
  expect(mockFix).toHaveBeenCalledTimes(2);
  expect(mockLoad).toHaveBeenCalledTimes(1);

  lateFix.release();
  await settle();

  expect(mockLoad).toHaveBeenCalledTimes(1);
});

it("offers a city during loading; a fetch that lands after the picker opened does not move on", async () => {
  const fix = later();
  mockFix.mockReturnValue(fix.promise);
  fetchLands();
  const props = stepProps();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderWithTheme(<FetchStep {...props} />);
  await settle();

  await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
  expect(screen.getByText(t("location.picker.title"))).toBeTruthy();
  fix.release();
  await settle();
  expect(props.onNext).not.toHaveBeenCalled();
  expect(screen.getByText(t("location.picker.title"))).toBeTruthy();

  await act(async () => mockPicker.onDone?.());
  expect(props.setSession).toHaveBeenCalledWith(CITY);
  expect(props.onNext).toHaveBeenCalledTimes(1);
});

it("names the city button for a screen reader while loading", async () => {
  mockFix.mockReturnValue(never());
  await renderWithTheme(<FetchStep {...stepProps()} />);
  await settle();

  expect(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY)).toHaveAccessibleName(
    t("a11y.onboarding.chooseCityManually")
  );
});

it("names the city row for a screen reader in the error state", async () => {
  mockFix.mockRejectedValue(new Error("timeout"));
  silencedWarn();
  await renderWithTheme(<FetchStep {...stepProps()} />);
  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

  expect(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY)).toHaveAccessibleName(OFFER_CITY_NAME());
});

// A chosen city shares no location, so the button says only what it shows.
describe("the city button for a city chosen by hand", () => {
  beforeEach(() => useLocationStore.setState({ locationMode: LocationMode.MANUAL }));

  it("is named by its words while loading", async () => {
    mockLoad.mockReturnValue(never());
    await renderWithTheme(<FetchStep {...stepProps()} />);
    await settle();

    expect(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY)).toHaveAccessibleName(
      t("onboarding.location.chooseCity")
    );
  });

  // The error's offer is the Location screen's: its row names what it shows.
  it("is the offer's city row, named by its words, in the error state", async () => {
    mockLoad.mockRejectedValue(new Error("offline"));
    silencedWarn();
    await renderWithTheme(<FetchStep {...stepProps()} />);
    await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

    expect(screen.getByText(t("onboarding.fetch.errorTitle"))).toBeTruthy();
    expect(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY)).toHaveAccessibleName(OFFER_CITY_NAME());
  });
});

it("moves on once when a city is picked after the fetch already landed", async () => {
  fetchLands();
  const props = stepProps();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderWithTheme(<FetchStep {...props} />);
  await settle();
  expect(props.onNext).toHaveBeenCalledTimes(1);

  await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
  await act(async () => mockPicker.onDone?.());

  expect(props.onNext).toHaveBeenCalledTimes(1);
});

it("keeps the picker when a fetch fails after it opened, and does not retry", async () => {
  const fix = later();
  mockFix.mockReturnValue(fix.promise);
  const props = stepProps();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderWithTheme(<FetchStep {...props} />);
  await settle();

  await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
  fix.fail(new Error("timeout"));
  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

  expect(screen.getByText(t("location.picker.title"))).toBeTruthy();
  expect(screen.queryByText(t("onboarding.fetch.errorTitle"))).toBeNull();
  expect(mockFix).toHaveBeenCalledTimes(1);
  expect(props.onNext).not.toHaveBeenCalled();
});

it("retries from the error state", async () => {
  silencedWarn();
  mockFix.mockRejectedValue(new Error("timeout"));
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);
  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));
  // The offer draws Retry; the frame's primary stays out of the way.
  expect(lastPrimary(props.setPrimary)).toBeNull();
  expect(primaryHidden(props.setPrimaryHidden)).toBe(true);

  mockFix.mockReset().mockResolvedValue(undefined);
  fetchLands();
  await pressRetry();
  await settle();

  expect(props.onNext).toHaveBeenCalledTimes(1);
});

it("returns to the error state when a retry fails again", async () => {
  silencedWarn();
  mockFix.mockRejectedValue(new Error("timeout"));
  const props = stepProps();
  await renderWithTheme(<FetchStep {...props} />);
  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

  await pressRetry();
  expect(screen.queryByText(t("onboarding.fetch.errorTitle"))).toBeNull();

  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));
  expect(mockFix).toHaveBeenCalledTimes(4);
  expect(screen.getByText(t("onboarding.fetch.errorTitle"))).toBeTruthy();
  expect(props.setBusy).not.toHaveBeenCalledWith(true);
  expect(props.onNext).not.toHaveBeenCalled();
});

it("moves on with a city picked from the error state", async () => {
  silencedWarn();
  mockFix.mockRejectedValue(new Error("timeout"));
  const props = stepProps();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderWithTheme(<FetchStep {...props} />);
  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

  await user.press(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY));
  expect(screen.getByText(t("location.picker.title"))).toBeTruthy();
  await act(async () => mockPicker.onDone?.());

  expect(props.setSession).toHaveBeenCalledWith(CITY);
  expect(props.onNext).toHaveBeenCalledTimes(1);
});

it("moves reader focus to the heading when the error and then the picker show", async () => {
  silencedWarn();
  const focus = jest
    .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
    .mockImplementation(() => {});
  // The jest setup already mocks it, so the spy carries earlier tests' calls.
  focus.mockClear();
  mockFix.mockRejectedValue(new Error("timeout"));
  const props = stepProps();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderWithTheme(<FetchStep {...props} />);
  expect(focus).not.toHaveBeenCalled();

  await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));
  expect(focus).toHaveBeenCalledTimes(1);
  expect(focus).toHaveBeenLastCalledWith(props.headingRef.current, "focus");

  await user.press(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY));
  expect(focus).toHaveBeenCalledTimes(2);
});

describe("the city picker", () => {
  it("hides the frame's primary while it shows", async () => {
    mockFix.mockReturnValue(never());
    const props = stepProps();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderWithTheme(<FetchStep {...props} />);
    await settle();

    await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));

    expect(screen.getByText(t("location.picker.title"))).toBeTruthy();
    expect(primaryHidden(props.setPrimaryHidden)).toBe(true);
  });

  it("goes back to a fresh load when it was opened while loading", async () => {
    mockFix.mockReturnValueOnce(never());
    fetchLands();
    const props = stepProps();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderWithTheme(<FetchStep {...props} />);
    await settle();
    await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));

    await act(async () => lastBack(props.setBack)?.());
    await settle();

    expect(mockFix).toHaveBeenCalledTimes(2);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("goes back to the error when it was opened from there", async () => {
    mockFix.mockRejectedValue(new Error("timeout"));
    silencedWarn();
    const props = stepProps();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderWithTheme(<FetchStep {...props} />);
    await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));
    await user.press(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY));

    await act(async () => lastBack(props.setBack)?.());

    expect(screen.getByText(t("onboarding.fetch.errorTitle"))).toBeTruthy();
    expect(mockFix).toHaveBeenCalledTimes(2);
    expect(primaryHidden(props.setPrimaryHidden)).toBe(true);
    expect(screen.getByRole("button", { name: t("common.retry") })).toBeTruthy();
  });

  it("offers coordinates, as the location step does", async () => {
    mockFix.mockReturnValue(never());
    const props = stepProps();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderWithTheme(<FetchStep {...props} />);
    await settle();
    await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));

    await act(async () => mockPicker.onEnterCoordinates?.());
    expect(screen.getByText(t("location.coordinates.title"))).toBeTruthy();
    await act(async () => mockCoordinates.onDone?.());

    expect(props.setSession).toHaveBeenCalledWith(CITY);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  describe("going back on the automatic path", () => {
    const AUTOMATIC = { ...NEW_SESSION, locationChoice: LOCATION_CHOICE.AUTOMATIC };
    /** Opens the picker over a stuck load, then goes back. */
    const openAndGoBack = async (props: StepProps) => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderWithTheme(<FetchStep {...props} />);
      await settle();
      await user.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
      await act(async () => lastBack(props.setBack)?.());
      await settle();
    };
    beforeEach(() => {
      mockFix.mockReturnValueOnce(never());
    });

    it("drops a city tried in this run before the new load", async () => {
      const props = stepProps({ session: AUTOMATIC });
      await openAndGoBack(props);

      expect(props.dropTriedCity).toHaveBeenCalledTimes(1);
      expect(mockFix).toHaveBeenCalledTimes(2);
      expect(jest.mocked(props.dropTriedCity).mock.invocationCallOrder[0]).toBeLessThan(
        mockFix.mock.invocationCallOrder[1]
      );
    });

    it("keeps a manual city the user did not choose automatic over", async () => {
      const props = stepProps();
      await openAndGoBack(props);

      expect(props.dropTriedCity).not.toHaveBeenCalled();
    });
  });
});

// The error draws the Location screen's offer: reason, Retry, manual ways.
describe("the error's offer", () => {
  const COORDINATES_NAME = () =>
    t("a11y.join", {
      first: t("location.picker.enterCoordinates"),
      second: t("location.failure.coordinatesNote"),
    });

  it("says the city was not found when the device read timed out", async () => {
    silencedWarn();
    mockFix.mockImplementation(async () => {
      useLocationStore.setState((state) => ({
        locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.TIMEOUT },
      }));
      throw new Error("timeout");
    });
    await renderWithTheme(<FetchStep {...stepProps()} />);
    await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

    expect(screen.getByText(t("location.failure.notFound.title"))).toBeTruthy();
  });

  it("says the times failed when a chosen city's load did", async () => {
    silencedWarn();
    useLocationStore.setState((state) => ({
      locationMode: LocationMode.MANUAL,
      locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.TIMEOUT },
    }));
    mockLoad.mockRejectedValue(new Error("offline"));
    await renderWithTheme(<FetchStep {...stepProps()} />);
    await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

    expect(screen.getByText(t("today.failed.title"))).toBeTruthy();
    expect(screen.queryByText(t("location.failure.notFound.title"))).toBeNull();
  });

  it("opens the coordinates straight from the error, and back returns to it", async () => {
    silencedWarn();
    mockFix.mockRejectedValue(new Error("timeout"));
    const props = stepProps();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderWithTheme(<FetchStep {...props} />);
    await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

    await user.press(screen.getByRole("button", { name: COORDINATES_NAME() }));
    expect(screen.getByText(t("location.coordinates.title"))).toBeTruthy();

    await act(async () => lastBack(props.setBack)?.());
    expect(screen.getByText(t("onboarding.fetch.errorTitle"))).toBeTruthy();
  });

  it("moves on with coordinates entered from the error", async () => {
    silencedWarn();
    mockFix.mockRejectedValue(new Error("timeout"));
    const props = stepProps();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderWithTheme(<FetchStep {...props} />);
    await act(() => jest.advanceTimersByTimeAsync(FETCH_RETRY_MS));

    await user.press(screen.getByRole("button", { name: COORDINATES_NAME() }));
    await act(async () => mockCoordinates.onDone?.());

    expect(props.setSession).toHaveBeenCalledWith(CITY);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });
});
