import { AccessibilityInfo } from "react-native";
import { act, userEvent } from "@testing-library/react-native";
import { screen } from "expo-router/testing-library";

import { CityChangeOffer } from "@/components/location/CityChangeOffer";
import { renderWithTheme } from "@/test-helpers/theme";

import { CITY_OFFER_PART, CITY_OFFER_STAGE } from "@/constants/CityOffer";
import { E2E_ID } from "@/constants/E2E";
import { AppLocale } from "@/enums/app";
import { UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { candidateAt, offerUp } from "@/test-helpers/cityOffer";
import {
  DUBAI_NAME,
  RIYADH_NAME,
  button,
  label,
  renderOffer,
  resetStatus,
  savedRiyadh,
  setFocused,
  setOffline,
  t,
  unnamedSavedPlace,
} from "@/test-helpers/cityOfferCard";
import { controlProblems } from "@/test-helpers/controls";

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
jest.mock("@/hooks/useLocationUpdate", () => ({
  useLocationUpdate: () => ({
    run: jest.requireActual("@/stores/locationUpdate").useLocationUpdateStore((s: any) => s.run),
    applyCandidate: jest.fn(),
    dismissFailure: jest.fn(),
  }),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  resetStatus();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  savedRiyadh();
});

afterEach(() => jest.restoreAllMocks());

describe("the offer", () => {
  it("names the city the device is in over the saved city's times", async () => {
    offerUp();
    await renderOffer();
    expect(
      screen.getByLabelText(
        t("a11y.join", {
          first: t("a11y.join", {
            first: t("location.cityChange.greeting"),
            second: t("location.cityOffer.title", { city: "Jeddah" }),
          }),
          second: t("location.cityOffer.body", { saved: "Riyadh" }),
        })
      )
    ).toBeTruthy();
    expect(button("location.cityOffer.use", { city: "Jeddah" })).toHaveProp(
      "accessibilityHint",
      t("a11y.location.cityOffer.useHint", { city: "Jeddah" })
    );
  });

  it("draws nothing without an offer", async () => {
    await renderOffer();
    expect(screen.queryByTestId(CITY_OFFER_PART.CARD)).toBeNull();
  });

  it("says the greeting above the title in the offer, and in no later view", async () => {
    offerUp();
    await renderOffer();
    expect(screen.getByText(t("location.cityChange.greeting"))).toBeTruthy();
    expect(label().startsWith(t("location.cityChange.greeting"))).toBe(true);
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    expect(screen.queryByText(t("location.cityChange.greeting"))).toBeNull();
    expect(label()).not.toContain(t("location.cityChange.greeting"));
  });

  it("leaves the greeting out of the updated view", async () => {
    offerUp(candidateAt(), { kind: CITY_OFFER_STAGE.UPDATED, alertsFollow: true });
    await renderOffer();
    expect(screen.queryByText(t("location.cityChange.greeting"))).toBeNull();
  });

  it("calls each city by its name in the app's language", async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    offerUp();
    await renderOffer();
    expect(label()).toContain(t("location.cityOffer.title", { city: "جدة" }));
    expect(label()).toContain(t("location.cityOffer.body", { saved: "الرياض" }));
  });

  it.each([
    ["Asia/Dubai", true],
    ["Asia/Kuwait", false],
    [null, false],
  ])("adds the zone line beside a place on %s: %s", async (zone, shown) => {
    offerUp(candidateAt({ zone, name: DUBAI_NAME }));
    await renderOffer();
    const greeting = t("location.cityChange.greeting");
    const title = t("location.cityOffer.title", { city: "Dubai" });
    const body = t("location.cityOffer.body", { saved: "Riyadh" });
    const zoneLine = t("location.zone.ahead.hours", { count: 1, place: "Dubai", other: "Riyadh" });
    if (shown) expect(label()).toContain(zoneLine);
    else
      expect(label()).toBe(
        t("a11y.join", { first: t("a11y.join", { first: greeting, second: title }), second: body })
      );
  });

  it("names the distance inside the same city, and drops the names from the buttons", async () => {
    offerUp(candidateAt({ name: RIYADH_NAME, distanceKm: 40.4 }));
    await renderOffer();
    expect(label()).toContain(
      t("location.cityOffer.sameName.body", { distance: 40, saved: "Riyadh" })
    );
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual([
      t("location.cityOffer.useHere"),
      t("location.cityOffer.keepSaved"),
    ]);
  });

  it("names the distance from the saved city for an unnamed place, and offers the picker", async () => {
    offerUp(candidateAt({ name: null, distanceKm: 40 }));
    await renderOffer();
    expect(label()).toContain(
      t("location.cityOffer.unnamed.title", { distance: 40, saved: "Riyadh" })
    );
    expect(button("location.cityOffer.useHere")).toBeTruthy();
    expect(button("location.cityOffer.keep", { saved: "Riyadh" })).toBeTruthy();
    expect(screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY)).toBeTruthy();
  });

  it("holds Use while offline, says why last, and keeps Keep open", async () => {
    await setOffline(true);
    offerUp();
    await renderOffer();
    expect(button("location.cityOffer.use", { city: "Jeddah" })).toBeDisabled();
    expect(label().endsWith(t("location.cityOffer.offline", { city: "Jeddah" }))).toBe(true);
    expect(button("location.cityOffer.keep", { saved: "Riyadh" })).not.toBeDisabled();
  });

  it("holds Use while another update runs, with the hourglass", async () => {
    useLocationUpdateStore.setState({
      run: { start: { kind: UPDATE_START.DEVICE }, step: UPDATE_STEP.LOCATION, failed: false },
    });
    offerUp();
    await renderOffer();
    expect(button("location.cityOffer.use", { city: "Jeddah" })).toBeDisabled();
    expect(label().endsWith(t("location.cityOffer.busy"))).toBe(true);
    expect(button("location.cityOffer.keep", { saved: "Riyadh" })).not.toBeDisabled();
  });

  it("holds Use while a device read runs", async () => {
    useLocationStore.setState({ isGettingLocation: true });
    offerUp();
    await renderOffer();
    expect(button("location.cityOffer.use", { city: "Jeddah" })).toBeDisabled();
    expect(label().endsWith(t("location.cityOffer.busy"))).toBe(true);
  });

  it("opens Use again when the connection returns, with no second announcement", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await setOffline(true);
    offerUp();
    await renderOffer();
    await setOffline(false);
    expect(button("location.cityOffer.use", { city: "Jeddah" })).not.toBeDisabled();
    expect(announce).toHaveBeenCalledTimes(1);
  });
});

describe("the answers", () => {
  it("keeps the saved times on Keep, offers Don't ask, and keeps the zone line", async () => {
    offerUp(candidateAt({ zone: "Asia/Dubai", name: DUBAI_NAME }));
    await renderOffer();
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    expect(label()).toContain(t("location.cityOffer.kept.title", { saved: "Riyadh" }));
    expect(label()).toContain(
      t("location.zone.ahead.hours", { count: 1, place: "Dubai", other: "Riyadh" })
    );
    expect(button("location.cityOffer.dontAsk", { city: "Dubai" })).toHaveProp(
      "accessibilityHint",
      t("a11y.location.cityOffer.dontAskHint")
    );
  });

  it("confirms Don't ask in place and drops the action", async () => {
    offerUp();
    await renderOffer();
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    await userEvent.press(button("location.cityOffer.dontAsk", { city: "Jeddah" }));
    expect(label()).toContain(t("location.cityOffer.muted.title", { city: "Jeddah" }));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("calls an unnamed saved place the saved place", async () => {
    unnamedSavedPlace();
    offerUp();
    await renderOffer();
    expect(label()).toContain(t("location.cityOffer.bodyNoSavedName"));
    expect(button("location.cityOffer.keepSaved")).toHaveProp(
      "accessibilityHint",
      t("a11y.location.cityOffer.keepSavedHint")
    );
    expect(label()).not.toMatch(/undefined|null/);
    await userEvent.press(button("location.cityOffer.keepSaved"));
    expect(label()).toContain(t("location.cityOffer.kept.titleHere"));
    expect(label()).toContain(t("location.cityOffer.kept.bodyNoSavedName", { city: "Jeddah" }));
  });
});

describe("saying it", () => {
  it("is not a live region", async () => {
    offerUp();
    await renderOffer();
    expect(screen.getByTestId("notice-card-text")).toHaveProp("accessibilityLiveRegion", "none");
  });

  it("moves focus to the text block after Keep and Don't ask, never on arrival", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    offerUp();
    await renderOffer();
    expect(focus).not.toHaveBeenCalled();
    await userEvent.press(button("location.cityOffer.keep", { saved: "Riyadh" }));
    expect(focus).toHaveBeenCalledTimes(1);
    await userEvent.press(button("location.cityOffer.dontAsk", { city: "Jeddah" }));
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it("hides the glyph and gives every control a role, a name and a 44pt target", async () => {
    offerUp(candidateAt({ name: null }));
    await renderOffer();
    expect(controlProblems()).toEqual([]);
  });

  it("announces the offer once, from the surface on screen", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    offerUp();
    await setFocused(false);
    await renderOffer();
    expect(announce).not.toHaveBeenCalled();
    await setFocused(true);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(label());
    // A second card on one offer is a remount: the offer remembers it was said.
    await renderWithTheme(<CityChangeOffer />);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(useLocationStore.getState().cityOffer?.announced).toBe(true);
  });
});
