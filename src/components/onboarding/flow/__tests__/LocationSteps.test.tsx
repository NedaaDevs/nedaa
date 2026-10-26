import { AccessibilityInfo, Platform } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import { LocationPermissionStep } from "@/components/onboarding/flow/steps/LocationPermissionStep";
import { LocationStep } from "@/components/onboarding/flow/steps/LocationStep";
import type { StepProps } from "@/components/onboarding/flow/types";
import { LOCATION_CHOICE, ONBOARDING_PART } from "@/constants/Onboarding";
import { AppLocale, PlatformType } from "@/enums/app";
import { LocationMode } from "@/enums/location";
import { LOCATION_UPDATE_PART } from "@/components/LocationUpdateProgress";
import { UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { controlProblems } from "@/test-helpers/controls";
import {
  coordinatesStub,
  PLACE,
  pickerStub,
  resetPickerStubs,
  updateStub,
} from "@/test-helpers/cityPickerStubs";
import { clearHaptics, HAPTIC } from "@/test-helpers/hapticMock";
import {
  lastBack,
  lastPrimary,
  primaryHidden,
  stepProps,
} from "@/test-helpers/onboardingStepProps";
import { later } from "@/test-helpers/promises";
import { renderWithTheme } from "@/test-helpers/theme";
import { requestLocationPermission } from "@/utils/location";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  requestLocationPermission: jest.fn(),
}));

jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

// A pick hands its place to the step, which waits on the update stub.
jest.mock(
  "@/components/location/CityPicker",
  () => jest.requireActual("@/test-helpers/cityPickerStubs").cityPickerModule
);
jest.mock(
  "@/components/location/CoordinateEntry",
  () => jest.requireActual("@/test-helpers/cityPickerStubs").coordinateEntryModule
);
jest.mock(
  "@/hooks/useLocationUpdate",
  () => jest.requireActual("@/test-helpers/cityPickerStubs").locationUpdateModule
);

const t = i18n.t.bind(i18n);
const mockRequest = jest.mocked(requestLocationPermission);
const called = (fn: unknown) => jest.mocked(fn as jest.Mock).mock.invocationCallOrder[0];
const CITY = { locationChoice: LOCATION_CHOICE.CITY };
const cityRow = () =>
  screen.getByRole("radio", { name: new RegExp(t("onboarding.location.city")) });
/** Opens the location step's city picker from its choices. */
const openLocationPicker = async (props: StepProps) => {
  await userEvent.press(cityRow());
  await act(async () => lastPrimary(props.setPrimary)?.onPress());
};
/** Presses back as the frame would: through the step's own handler. */
const stepBack = (props: StepProps) => act(async () => lastBack(props.setBack)?.());
/** Spies on reader focus, from a clean count. */
const focusSpy = () => {
  const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
  focus.mockImplementation(() => {}).mockClear();
  return focus;
};
afterEach(() => jest.restoreAllMocks());

beforeEach(async () => {
  await act(() => i18n.changeLanguage(AppLocale.EN));
  mockRequest.mockReset().mockResolvedValue({ granted: false });
  clearHaptics();
  resetPickerStubs();
  useLocationStore.setState({ locationMode: LocationMode.DEVICE, manualLocation: null });
});

describe("LocationStep", () => {
  it("takes automatic location by default, then advances", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);

    await act(async () => lastPrimary(props.setPrimary)?.onPress());

    expect(props.setSession).toHaveBeenCalledWith({ locationChoice: LOCATION_CHOICE.AUTOMATIC });
    expect(called(props.setSession)).toBeLessThan(called(props.onNext));
    expect(controlProblems()).toEqual([]);
  });

  it("opens the city picker from the row the CI flow taps", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);

    await userEvent.press(screen.getByTestId(ONBOARDING_PART.LOCATION_CITY));
    await act(async () => lastPrimary(props.setPrimary)?.onPress());

    expect(pickerStub.pick).toBeDefined();
    expect(props.onNext).not.toHaveBeenCalled();
  });

  // A city tried and left gives way to the device's own place.
  it("drops a city tried in this run before it takes the automatic choice", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);

    await act(async () => lastPrimary(props.setPrimary)?.onPress());

    expect(props.dropTriedCity).toHaveBeenCalledTimes(1);
    expect(called(props.dropTriedCity)).toBeLessThan(called(props.setSession));
  });

  // A pick still loading as the user leaves lands on a city since dropped.
  it("ignores a pick that lands after automatic dropped its city", async () => {
    const props = stepProps({
      dropTriedCity: jest.fn(() =>
        useLocationStore.setState({ locationMode: LocationMode.DEVICE })
      ),
    });
    await renderWithTheme(<LocationStep {...props} />);
    await openLocationPicker(props);
    const landing = pickerStub.pick;
    // The pick has stored its city and is still loading the times.
    useLocationStore.setState({ locationMode: LocationMode.MANUAL });

    await stepBack(props);
    await userEvent.press(
      screen.getByRole("radio", { name: new RegExp(t("onboarding.location.automatic")) })
    );
    await act(async () => lastPrimary(props.setPrimary)?.onPress());
    await act(async () => landing?.());

    expect(props.setSession).not.toHaveBeenCalledWith(CITY);
    expect(jest.mocked(props.setSession).mock.lastCall).toEqual([
      { locationChoice: LOCATION_CHOICE.AUTOMATIC },
    ]);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("takes a pick that lands after the list closed while its city is still stored", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);
    await openLocationPicker(props);
    const landing = pickerStub.pick;
    useLocationStore.setState({ locationMode: LocationMode.MANUAL });

    await stepBack(props);
    await act(async () => landing?.());

    expect(props.setSession).toHaveBeenCalledWith(CITY);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("opens the city picker, which reports the city before advancing", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);

    await openLocationPicker(props);
    expect(props.onNext).not.toHaveBeenCalled();

    await act(async () => pickerStub.pick?.());
    expect(props.setSession).toHaveBeenCalledWith(CITY);
    expect(called(props.setSession)).toBeLessThan(called(props.onNext));
  });

  // Onboarding has no Location screen behind it: a pick waits in the step.
  it("waits in the step until the pick's update lands", async () => {
    const update = later<boolean>();
    updateStub.applyManualLocation.mockReturnValue(update.promise);
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);
    await openLocationPicker(props);

    await act(async () => pickerStub.pick?.());
    expect(updateStub.applyManualLocation).toHaveBeenCalledWith(PLACE);
    expect(props.onNext).not.toHaveBeenCalled();

    await act(async () => update.release(true));
    expect(props.setSession).toHaveBeenCalledWith(CITY);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("shows the pick's update steps in the step while it runs", async () => {
    updateStub.run = {
      start: { kind: UPDATE_START.CITY, city: PLACE },
      step: UPDATE_STEP.PRAYER_TIMES,
      failed: false,
    };
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);
    await openLocationPicker(props);

    expect(screen.getByTestId(LOCATION_UPDATE_PART.FRAME)).toBeTruthy();
  });

  // A pick whose times failed is retried in place; landing moves the step on.
  it("moves on once a retried pick lands", async () => {
    updateStub.run = {
      start: { kind: UPDATE_START.CITY, city: PLACE },
      step: UPDATE_STEP.PRAYER_TIMES,
      failed: true,
    };
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);
    await openLocationPicker(props);

    await userEvent.press(screen.getByRole("button", { name: t("common.retry") }));

    expect(updateStub.retry).toHaveBeenCalledTimes(1);
    expect(props.setSession).toHaveBeenCalledWith(CITY);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  // Back and Skip wait while a picked city's update runs.
  it("holds the frame busy until the pick's update settles", async () => {
    const update = later<boolean>();
    updateStub.applyManualLocation.mockReturnValue(update.promise);
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);
    await openLocationPicker(props);

    await act(async () => pickerStub.pick?.());
    expect(jest.mocked(props.setBusy).mock.calls).toEqual([[true]]);

    await act(async () => update.release(false));
    expect(jest.mocked(props.setBusy).mock.calls).toEqual([[true], [false]]);
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it("holds the frame busy until a retried pick settles", async () => {
    updateStub.run = {
      start: { kind: UPDATE_START.CITY, city: PLACE },
      step: UPDATE_STEP.PRAYER_TIMES,
      failed: true,
    };
    const update = later<boolean>();
    updateStub.retry.mockReturnValue(update.promise);
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);
    await openLocationPicker(props);

    await userEvent.press(screen.getByRole("button", { name: t("common.retry") }));
    expect(jest.mocked(props.setBusy).mock.calls).toEqual([[true]]);

    await act(async () => update.release(true));
    expect(jest.mocked(props.setBusy).mock.calls).toEqual([[true], [false]]);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  // As the language list does, every press on a row ticks, the chosen one too.
  it("ticks once for each press on a location row", async () => {
    await renderWithTheme(<LocationStep {...stepProps()} />);
    const row = (key: string) => screen.getByRole("radio", { name: new RegExp(t(key)) });

    await userEvent.press(row("onboarding.location.automatic"));
    expect(HAPTIC[HAPTIC_FEEDBACK.SELECTION]).toHaveBeenCalledTimes(1);

    await userEvent.press(row("onboarding.location.city"));
    expect(HAPTIC[HAPTIC_FEEDBACK.SELECTION]).toHaveBeenCalledTimes(2);
  });

  it("reaches coordinates from the picker, and takes the city they give", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);
    await openLocationPicker(props);

    await act(async () => pickerStub.onEnterCoordinates?.());
    await act(async () => coordinatesStub.save?.());

    expect(props.setSession).toHaveBeenCalledWith(CITY);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  // One «رجوع» does one thing: the frame's back walks out of the sub-views.
  it("steps back from coordinates to the picker to the choices, with no back of its own", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);
    expect(lastBack(props.setBack)).toBeNull();
    await openLocationPicker(props);
    await act(async () => pickerStub.onEnterCoordinates?.());
    expect(screen.getByText(t("location.coordinates.title"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("onboarding.back") })).toBeNull();

    await stepBack(props);
    expect(screen.getByText(t("location.picker.title"))).toBeTruthy();

    await stepBack(props);
    expect(cityRow()).toBeTruthy();
    expect(lastBack(props.setBack)).toBeNull();
    expect(lastPrimary(props.setPrimary)).not.toBeNull();
  });

  it("hides the frame's primary while the picker or coordinates show", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);
    expect(primaryHidden(props.setPrimaryHidden)).toBe(false);

    await openLocationPicker(props);
    expect(primaryHidden(props.setPrimaryHidden)).toBe(true);
    await act(async () => pickerStub.onEnterCoordinates?.());
    expect(primaryHidden(props.setPrimaryHidden)).toBe(true);

    await stepBack(props);
    await stepBack(props);
    expect(primaryHidden(props.setPrimaryHidden)).toBe(false);
  });

  it("moves reader focus to the heading on each view change", async () => {
    const focus = focusSpy();
    const props = stepProps();
    await renderWithTheme(<LocationStep {...props} />);
    expect(focus).not.toHaveBeenCalled();

    await openLocationPicker(props);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenLastCalledWith(props.headingRef.current, "focus");

    await act(async () => pickerStub.onEnterCoordinates?.());
    expect(focus).toHaveBeenCalledTimes(2);

    await stepBack(props);
    await stepBack(props);
    expect(focus).toHaveBeenCalledTimes(4);
    expect(focus).toHaveBeenLastCalledWith(props.headingRef.current, "focus");
  });
});

describe("LocationPermissionStep", () => {
  it("asks for location once on a double tap", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationPermissionStep {...props} />);
    const primary = lastPrimary(props.setPrimary);

    await act(async () => {
      primary?.onPress();
      primary?.onPress();
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("reports the grant, then advances", async () => {
    mockRequest.mockResolvedValue({ granted: true });
    const props = stepProps();
    await renderWithTheme(<LocationPermissionStep {...props} />);

    await act(async () => lastPrimary(props.setPrimary)?.onPress());

    expect(props.setSession).toHaveBeenCalledWith({ locationGranted: true });
    expect(called(props.setSession)).toBeLessThan(called(props.onNext));
    expect(jest.mocked(props.setBusy).mock.calls).toEqual([[true], [false]]);
  });

  it("stays after a denial and offers a city instead", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationPermissionStep {...props} />);

    await act(async () => lastPrimary(props.setPrimary)?.onPress());

    expect(props.onNext).not.toHaveBeenCalled();
    expect(screen.getByText(t("onboarding.location.deniedBody"))).toBeTruthy();
    expect(lastPrimary(props.setPrimary)).toBeNull();

    expect(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY)).toHaveAccessibleName(
      t("a11y.onboarding.chooseCityManually")
    );

    await userEvent.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
    await act(async () => pickerStub.pick?.());

    expect(props.setSession).toHaveBeenCalledWith(CITY);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  /** Denies the prime, then opens its city picker. */
  const openDeniedPicker = async (props: StepProps) => {
    await act(async () => lastPrimary(props.setPrimary)?.onPress());
    await userEvent.press(screen.getByTestId(ONBOARDING_PART.CHOOSE_CITY));
  };

  it("offers coordinates from its picker, as the location step does", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationPermissionStep {...props} />);
    await openDeniedPicker(props);

    await act(async () => pickerStub.onEnterCoordinates?.());
    expect(screen.getByText(t("location.coordinates.title"))).toBeTruthy();
    await act(async () => coordinatesStub.save?.());

    expect(props.setSession).toHaveBeenCalledWith(CITY);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("hides the frame's primary in the picker, and back returns to the denial", async () => {
    const props = stepProps();
    await renderWithTheme(<LocationPermissionStep {...props} />);
    await openDeniedPicker(props);
    expect(primaryHidden(props.setPrimaryHidden)).toBe(true);

    await stepBack(props);

    expect(screen.getByText(t("onboarding.location.deniedBody"))).toBeTruthy();
    expect(primaryHidden(props.setPrimaryHidden)).toBe(false);
    expect(lastBack(props.setBack)).toBeNull();
  });

  it("moves reader focus to the heading when the picker opens and closes", async () => {
    const focus = focusSpy();
    const props = stepProps();
    await renderWithTheme(<LocationPermissionStep {...props} />);
    await openDeniedPicker(props);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenLastCalledWith(props.headingRef.current, "focus");

    await stepBack(props);
    expect(focus).toHaveBeenCalledTimes(2);
  });

  describe("speaking the denial", () => {
    const PLATFORM = Platform.OS;
    beforeEach(() => jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear());
    afterEach(() => {
      Platform.OS = PLATFORM;
    });

    // Android speaks the live region; iOS has none, so the step says it.
    it("says it on iOS once the answer comes, and not before", async () => {
      Platform.OS = PlatformType.IOS;
      const props = stepProps();
      await renderWithTheme(<LocationPermissionStep {...props} />);
      expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();

      await act(async () => lastPrimary(props.setPrimary)?.onPress());

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        t("onboarding.location.deniedBody")
      );
    });

    it("leaves Android to its live region", async () => {
      Platform.OS = PlatformType.ANDROID;
      const props = stepProps();
      await renderWithTheme(<LocationPermissionStep {...props} />);
      expect(
        screen.getByText(t("onboarding.locationPermission.card")).props.accessibilityLiveRegion
      ).not.toBe("polite");

      await act(async () => lastPrimary(props.setPrimary)?.onPress());

      expect(
        screen.getByText(t("onboarding.location.deniedBody")).props.accessibilityLiveRegion
      ).toBe("polite");
      expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
    });
  });
});
