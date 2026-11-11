import { Text } from "react-native";
import { router, usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { act, renderRouter, screen } from "expo-router/testing-library";

import { LocationNotice } from "@/components/today/LocationNotice";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { LOCATION_FAILURE, UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import { CITY_OFFER_PART, CITY_OFFER_STAGE, type CityOfferStageKind } from "@/constants/CityOffer";
import i18n from "@/localization/i18n";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import type { CityOfferStage } from "@/types/cityCheck";
import { candidateAt, offerUp } from "@/test-helpers/cityOffer";
import { savedRiyadh } from "@/test-helpers/cityOfferCard";
import { placeFacts } from "@/test-helpers/place";
import { RIYADH_COORDS } from "@/test-helpers/prayerDay";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { controlProblems } from "@/test-helpers/controls";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/hooks/useIsOffline", () => ({ useIsOffline: () => false }));
jest.mock("@/hooks/useLocationUpdate", () => ({
  useLocationUpdate: () => ({
    run: jest.requireActual("@/stores/locationUpdate").useLocationUpdateStore((s: any) => s.run),
    applyCandidate: jest.fn(),
    dismissFailure: jest.fn(),
  }),
}));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderNotice = () =>
  renderRouter(
    {
      [BACK_DESTINATION.HOME.route]: () => (
        <>
          <LocationNotice />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.HOME.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const visitOtherAndBack = async () => {
  await act(async () => router.navigate(BACK_DESTINATION.SETTINGS_LOCATION.href));
  await act(() => router.back());
};

const stageOf = (kind: CityOfferStageKind): CityOfferStage =>
  kind === CITY_OFFER_STAGE.UPDATED ? { kind, alertsFollow: true } : { kind };

beforeEach(() => {
  savedRiyadh();
  useLocationUpdateStore.setState({ run: null });
});

describe("LocationNotice", () => {
  // The times fall back to Makkah so the app works without a location; say so.
  it("says the times are Makkah's while no location is known", async () => {
    placeFacts(true, null);
    await renderNotice();

    expect(screen.getByLabelText(i18n.t("today.defaultLocation.body"))).toBeTruthy();
  });

  // A found place is no failure to find one; its times are what is missing.
  it("says Makkah's times stand in until a found place's times load", async () => {
    placeFacts(true, RIYADH_COORDS);
    await renderNotice();

    expect(screen.getByLabelText(i18n.t("today.defaultLocation.awaitingTimes"))).toBeTruthy();
    expect(screen.queryByLabelText(i18n.t("today.defaultLocation.body"))).toBeNull();
  });

  it("stays away once the times are for the user's own place", async () => {
    placeFacts(false, RIYADH_COORDS);
    await renderNotice();

    expect(screen.queryByLabelText(i18n.t("today.defaultLocation.body"))).toBeNull();
    expect(screen.queryByLabelText(i18n.t("today.defaultLocation.awaitingTimes"))).toBeNull();
  });

  it("opens the location settings to set one", async () => {
    placeFacts(true, null);
    await renderNotice();

    await userEvent.press(
      screen.getByRole("button", { name: i18n.t("today.defaultLocation.action") })
    );

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_LOCATION.href)
    );
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    placeFacts(true, null);
    await renderNotice();

    expect(controlProblems()).toEqual([]);
  });

  describe("the city offer", () => {
    it("draws the city offer while the times are the user's own place", async () => {
      placeFacts(false, RIYADH_COORDS);
      offerUp();
      await renderNotice();

      expect(screen.getByTestId(CITY_OFFER_PART.CARD)).toBeTruthy();
    });

    it("keeps the default-location notice over an offer: one note in the slot", async () => {
      placeFacts(true, null);
      offerUp();
      await renderNotice();

      expect(screen.getByLabelText(i18n.t("today.defaultLocation.body"))).toBeTruthy();
      expect(screen.queryByTestId(CITY_OFFER_PART.CARD)).toBeNull();
    });

    it.each([CITY_OFFER_STAGE.KEPT, CITY_OFFER_STAGE.MUTED, CITY_OFFER_STAGE.UPDATED])(
      "takes a %s note down the next time Today shows, not before",
      async (kind) => {
        placeFacts(false, RIYADH_COORDS);
        offerUp();
        await renderNotice();
        await act(() => useLocationStore.getState().settleCityOffer(stageOf(kind)));

        expect(screen.getByTestId(CITY_OFFER_PART.CARD)).toBeTruthy();
        await visitOtherAndBack();
        expect(useLocationStore.getState().cityOffer).toBeNull();
      }
    );

    it("keeps an unanswered offer through a visit to another screen", async () => {
      placeFacts(false, RIYADH_COORDS);
      offerUp();
      await renderNotice();
      await visitOtherAndBack();

      expect(useLocationStore.getState().cityOffer?.stage.kind).toBe(CITY_OFFER_STAGE.OFFER);
      expect(screen.getByTestId(CITY_OFFER_PART.CARD)).toBeTruthy();
    });

    it("finds a failed offer's card by the same id", async () => {
      placeFacts(false, RIYADH_COORDS);
      const candidate = candidateAt();
      offerUp(candidate);
      useLocationStore.setState((state) => ({
        locationDetails: { ...state.locationDetails, error: LOCATION_FAILURE.TIMEOUT },
      }));
      useLocationUpdateStore.setState({
        run: {
          start: { kind: UPDATE_START.CANDIDATE, candidate },
          step: UPDATE_STEP.LOCATION,
          failed: true,
        },
      });
      await renderNotice();

      expect(screen.getByTestId(CITY_OFFER_PART.CARD)).toBeTruthy();
      expect(screen.getByText(i18n.t("location.failure.notFound.title"))).toBeTruthy();
    });
  });
});
