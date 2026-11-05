import { AccessibilityInfo, Platform, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, usePathname } from "expo-router";
import { act, userEvent } from "@testing-library/react-native";
import { screen } from "expo-router/testing-library";

import { LOCATION_UPDATE_PART } from "@/components/LocationUpdateProgress";
import { NOTICE_CARD_PART } from "@/components/ui/notice-card";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { CITY_OFFER_PART, CITY_OFFER_STAGE } from "@/constants/CityOffer";
import { E2E_ID } from "@/constants/E2E";
import {
  CITY_PICKER_VIEW,
  LOCATION_FAILURE,
  LOCATION_PICKER,
  RUN_END,
  STEP_OUTCOME,
  UPDATE_START,
  UPDATE_STEP,
} from "@/constants/Location";
import { AppLocale, PlatformType } from "@/enums/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore, type UpdateResult } from "@/stores/locationUpdate";
import { candidateAt, offerUp } from "@/test-helpers/cityOffer";
import {
  ALL_DONE,
  DUBAI_NAME,
  DUBAI_PLACE,
  JEDDAH_PLACE,
  UNNAMED_PLACE,
  button,
  label,
  landWith,
  renderOffer,
  resetStatus,
  savedRiyadh,
  setFocused,
  stopWith,
  t,
} from "@/test-helpers/cityOfferCard";
import { DUBAI_ZONE } from "@/test-helpers/place";
import { RIYADH_COORDS } from "@/test-helpers/prayerDay";
import { normalizeRoutePath } from "@/test-helpers/routeTree";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/hooks/useIsOffline", () => ({
  useIsOffline: () => jest.requireActual("@/test-helpers/cityOfferCard").useOffline(),
}));
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useIsFocused: () => jest.requireActual("@/test-helpers/cityOfferCard").useFocused(),
}));
const mockApplyCandidate = jest.fn();
const mockDismissFailure = jest.fn();
jest.mock("@/hooks/useLocationUpdate", () => ({
  useLocationUpdate: () => ({
    run: jest.requireActual("@/stores/locationUpdate").useLocationUpdateStore((s: any) => s.run),
    applyCandidate: (...args: unknown[]) => mockApplyCandidate(...args),
    dismissFailure: (...args: unknown[]) => mockDismissFailure(...args),
  }),
}));

/** The picker route, printing what it was opened on. */
const Picker = () => {
  const params = useLocalSearchParams();
  return (
    <Text testID="pathname">
      {usePathname()}?{String(params[LOCATION_PICKER.viewParam])}
    </Text>
  );
};

const renderWithPicker = () =>
  renderOffer({
    extraRoutes: { [BACK_DESTINATION.SETTINGS_LOCATION_PICKER.route]: () => <Picker /> },
  });

const pressUse = (city: string) => userEvent.press(button("location.cityOffer.use", { city }));

beforeEach(async () => {
  jest.clearAllMocks();
  resetStatus();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  savedRiyadh();
});

afterEach(() => jest.restoreAllMocks());

describe("the run inside the card", () => {
  it("starts the candidate's update on Use and draws its steps flat under the title", async () => {
    mockApplyCandidate.mockImplementation(() => new Promise(() => {}));
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(mockApplyCandidate).toHaveBeenCalledWith(
      useLocationStore.getState().cityOffer?.candidate
    );
    await act(async () =>
      useLocationUpdateStore.setState({
        run: {
          start: { kind: UPDATE_START.CANDIDATE, candidate: candidateAt() },
          step: UPDATE_STEP.PRAYER_TIMES,
          failed: false,
        },
      })
    );
    expect(label()).toBe(t("location.cityOffer.title", { city: "Jeddah" }));
    expect(
      StyleSheet.flatten(screen.getByTestId(LOCATION_UPDATE_PART.FRAME).props.style)
        ?.backgroundColor
    ).toBeUndefined();
  });

  it("moves focus to the text block after Use and after Retry", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    stopWith(mockApplyCandidate, JEDDAH_PLACE, UPDATE_STEP.NOTIFICATIONS);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(focus).toHaveBeenCalledTimes(1);
    await userEvent.press(button("common.retry"));
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it("says the times are now for the new city once the run lands", async () => {
    landWith(mockApplyCandidate, JEDDAH_PLACE, ALL_DONE);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(label()).toBe(
      t("a11y.join", {
        first: t("location.cityOffer.updated.title", { city: "Jeddah" }),
        second: t("location.cityOffer.updated.body", { city: "Jeddah" }),
      })
    );
    expect(screen.getByTestId(NOTICE_CARD_PART.TEXT)).toHaveProp("accessibilityLiveRegion", "none");
  });

  it("says the times are for the place you are in when the updated place has no name", async () => {
    landWith(mockApplyCandidate, UNNAMED_PLACE, ALL_DONE);
    offerUp(candidateAt({ name: null }));
    await renderOffer();
    await userEvent.press(button("location.cityOffer.useHere"));
    expect(label()).toContain(t("location.cityOffer.updated.titleUnnamed"));
    expect(label()).not.toContain(t("location.cityOffer.updated.titleHere", { saved: "Riyadh" }));
  });

  it("leaves the notifications line out when notifications were skipped", async () => {
    landWith(mockApplyCandidate, JEDDAH_PLACE, {
      ...ALL_DONE,
      [UPDATE_STEP.NOTIFICATIONS]: STEP_OUTCOME.SKIPPED,
    });
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(label()).toBe(t("location.cityOffer.updated.title", { city: "Jeddah" }));
  });

  it("keeps the zone line after the update, against the place the times came from", async () => {
    landWith(mockApplyCandidate, DUBAI_PLACE, ALL_DONE);
    offerUp(candidateAt({ zone: DUBAI_ZONE, name: DUBAI_NAME }));
    await renderOffer();
    await pressUse("Dubai");
    expect(label()).toContain(
      t("location.zone.ahead.hours", { count: 1, place: "Dubai", other: "Riyadh" })
    );
  });

  it("keeps the card after its own update lands", async () => {
    landWith(mockApplyCandidate, JEDDAH_PLACE, ALL_DONE);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(useLocationStore.getState().cityOffer?.stage.kind).toBe(CITY_OFFER_STAGE.UPDATED);
    expect(screen.getByTestId(CITY_OFFER_PART.CARD)).toBeTruthy();
  });

  it("settles nothing when the offer was taken down during its run", async () => {
    let land: (result: UpdateResult) => void = () => {};
    mockApplyCandidate.mockImplementation(
      () =>
        new Promise((resolve) => {
          land = resolve;
        })
    );
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    await act(async () => {
      useLocationStore.getState().dismissCityOffer();
      offerUp(candidateAt({ name: DUBAI_NAME }));
    });
    await act(async () => land({ end: RUN_END.LANDED, outcomes: ALL_DONE }));
    expect(useLocationStore.getState().cityOffer?.stage.kind).toBe(CITY_OFFER_STAGE.OFFER);
  });
});

describe("a run that stops", () => {
  it("draws a failed read or fetch as the card failure offer, naming the city", async () => {
    stopWith(mockApplyCandidate, JEDDAH_PLACE, UPDATE_STEP.PRAYER_TIMES);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(screen.getByText(t("location.failure.times.title", { city: "Jeddah" }))).toBeTruthy();
    expect(screen.getByText(t("today.failed.body"))).toBeTruthy();
    expect(button("location.cityOffer.keep", { saved: "Riyadh" })).toBeTruthy();
  });

  it("says the times are for the new city when the place settled under the failed run", async () => {
    stopWith(mockApplyCandidate, JEDDAH_PLACE, UPDATE_STEP.PRAYER_TIMES, { settled: true });
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(label()).toContain(t("location.cityOffer.updated.title", { city: "Jeddah" }));
    expect(
      screen.queryByRole("button", { name: t("location.cityOffer.keep", { saved: "Riyadh" }) })
    ).toBeNull();
    expect(mockDismissFailure).toHaveBeenCalled();
    expect(useLocationStore.getState().cityOffer?.stage).toEqual({
      kind: CITY_OFFER_STAGE.UPDATED,
      alertsFollow: false,
    });
  });

  it("puts the saved place back on Keep after a times failure", async () => {
    stopWith(mockApplyCandidate, JEDDAH_PLACE, UPDATE_STEP.PRAYER_TIMES);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    expect(useLocationStore.getState().locationDetails.coords).toMatchObject(RIYADH_COORDS);
    expect(useLocationStore.getState().previousPlace).toBeNull();
    expect(useLocationStore.getState().cityOffer?.stage.kind).toBe(CITY_OFFER_STAGE.KEPT);
    expect(mockDismissFailure).toHaveBeenCalled();
    expect(label()).toContain(t("location.cityOffer.kept.title", { saved: "Riyadh" }));
  });

  it.each([
    ["refetches", true, 1],
    ["leaves the stored days", false, 0],
  ])("%s on Keep when a split is %s", async (_name, timesSplit, loads) => {
    const { loadPrayerTimesAtCurrentPlace } = usePrayerTimesStore.getState();
    const load = jest.fn(async () => true);
    usePrayerTimesStore.setState({ timesSplit, loadPrayerTimesAtCurrentPlace: load });
    stopWith(mockApplyCandidate, JEDDAH_PLACE, UPDATE_STEP.PRAYER_TIMES);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");

    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));

    expect(load).toHaveBeenCalledTimes(loads);
    usePrayerTimesStore.setState({ timesSplit: false, loadPrayerTimesAtCurrentPlace });
  });

  it("keeps the saved place on Keep after a failed read, which wrote none", async () => {
    useLocationStore.setState((state) => ({
      locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.TIMEOUT },
    }));
    stopWith(mockApplyCandidate, null, UPDATE_STEP.LOCATION);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    const before = useLocationStore.getState().placeRevision;
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    expect(useLocationStore.getState().placeRevision).toBe(before);
    expect(useLocationStore.getState().locationDetails.error).toBeNull();
    expect(useLocationStore.getState().cityOffer?.stage.kind).toBe(CITY_OFFER_STAGE.KEPT);
  });

  it("puts the saved place back on Keep when a retry's read failed after the place was written", async () => {
    stopWith(mockApplyCandidate, JEDDAH_PLACE, UPDATE_STEP.PRAYER_TIMES);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    useLocationStore.setState((state) => ({
      locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.TIMEOUT },
    }));
    stopWith(mockApplyCandidate, null, UPDATE_STEP.LOCATION);
    await userEvent.press(button("common.retry"));
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    const state = useLocationStore.getState();
    expect(state.locationDetails.coords).toMatchObject(RIYADH_COORDS);
    expect(state.previousPlace).toBeNull();
    expect(state.locationDetails.error).toBeNull();
    expect(state.cityOffer?.stage.kind).toBe(CITY_OFFER_STAGE.KEPT);
  });

  it("offers Close, not Keep, once the times landed and a retry stops again", async () => {
    stopWith(mockApplyCandidate, JEDDAH_PLACE, UPDATE_STEP.NOTIFICATIONS, { settled: true });
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    stopWith(mockApplyCandidate, JEDDAH_PLACE, UPDATE_STEP.PRAYER_TIMES);
    await userEvent.press(button("common.retry"));
    expect(button("common.retry")).toBeTruthy();
    expect(button("common.close")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: t("location.cityOffer.keep", { saved: "Riyadh" }) })
    ).toBeNull();
    await userEvent.press(button("common.close"));
    expect(useLocationStore.getState().cityOffer).toBeNull();
    expect(useLocationStore.getState().locationDetails.coords).toMatchObject({
      latitude: JEDDAH_PLACE.coords.latitude,
      longitude: JEDDAH_PLACE.coords.longitude,
    });
  });

  it("stays quiet about a failed run while the screen is not focused", async () => {
    useLocationStore.setState((state) => ({
      locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.DENIED },
    }));
    stopWith(mockApplyCandidate, null, UPDATE_STEP.LOCATION);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(screen.getByText(t("location.failure.denied.title"))).toBeTruthy();
    await setFocused(false);
    expect(screen.queryByText(t("location.failure.denied.title"))).toBeNull();
    expect(screen.queryByTestId(LOCATION_UPDATE_PART.FRAME)).toBeNull();
  });

  it("says the place changed when the update set none and no read failed", async () => {
    stopWith(mockApplyCandidate, null, UPDATE_STEP.LOCATION);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(label()).toBe(
      t("a11y.join", {
        first: t("location.cityOffer.notApplied.title"),
        second: t("location.cityOffer.notApplied.body"),
      })
    );
    expect(screen.queryByText(t("location.failure.times.title", { city: "Jeddah" }))).toBeNull();
    await userEvent.press(button("common.close"));
    expect(mockDismissFailure).toHaveBeenCalled();
    expect(useLocationStore.getState().cityOffer).toBeNull();
  });

  describe("on iOS", () => {
    const platform = Platform.OS;
    beforeEach(() => {
      Platform.OS = PlatformType.IOS;
    });
    afterEach(() => {
      Platform.OS = platform;
    });

    it("says the place changed once and reads the card as a live region", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      stopWith(mockApplyCandidate, null, UPDATE_STEP.LOCATION);
      offerUp();
      await renderOffer();
      await pressUse("Jeddah");
      const joined = t("a11y.join", {
        first: t("location.cityOffer.notApplied.title"),
        second: t("location.cityOffer.notApplied.body"),
      });
      expect(announce.mock.calls.filter(([message]) => message === joined)).toHaveLength(1);
      expect(screen.getByTestId(NOTICE_CARD_PART.TEXT)).toHaveProp(
        "accessibilityLiveRegion",
        "polite"
      );
    });
  });

  it("names a stored refusal as the failure when the read stopped", async () => {
    useLocationStore.setState((state) => ({
      locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.DENIED },
    }));
    stopWith(mockApplyCandidate, null, UPDATE_STEP.LOCATION);
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(screen.getByText(t("location.failure.denied.title"))).toBeTruthy();
    expect(screen.queryByText(t("location.cityOffer.notApplied.title"))).toBeNull();
  });

  it("says the times landed when notifications stop, with Retry and Close", async () => {
    stopWith(mockApplyCandidate, JEDDAH_PLACE, UPDATE_STEP.NOTIFICATIONS, { settled: true });
    offerUp();
    await renderOffer();
    await pressUse("Jeddah");
    expect(label()).toContain(t("location.cityOffer.updated.title", { city: "Jeddah" }));
    expect(screen.getByText(t("location.update.failed.notifications"))).toBeTruthy();
    await userEvent.press(button("common.close"));
    expect(useLocationStore.getState().cityOffer).toBeNull();
    expect(mockDismissFailure).toHaveBeenCalled();
  });

  it("closes the run and the offer and opens the picker on Choose my city", async () => {
    useLocationStore.setState((state) => ({
      locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.TIMEOUT },
    }));
    stopWith(mockApplyCandidate, null, UPDATE_STEP.LOCATION);
    offerUp();
    await renderWithPicker();
    await pressUse("Jeddah");
    await userEvent.press(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY));
    expect(mockDismissFailure).toHaveBeenCalled();
    expect(useLocationStore.getState().cityOffer).toBeNull();
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      `${normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION_PICKER.href)}?${CITY_PICKER_VIEW.LIST}`
    );
  });
});
