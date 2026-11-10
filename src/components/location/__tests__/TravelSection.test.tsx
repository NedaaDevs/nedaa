import type { ParseKeys } from "i18next";
import { act, screen, userEvent } from "@testing-library/react-native";

import { TravelSection } from "@/components/location/TravelSection";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { TRAVEL_MODE, type TravelMode } from "@/constants/CityCheck";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useCityCheckStore, EMPTY_MEMORY } from "@/stores/cityCheck";
import { useLocationStore } from "@/stores/location";
import { offerUp } from "@/test-helpers/cityOffer";
import { savedRiyadh, t, unnamedSavedPlace } from "@/test-helpers/cityOfferCard";
import { FAR_MARK, JEDDAH_MARK, JEDDAH_ROW } from "@/test-helpers/cityRows";
import { controlProblems } from "@/test-helpers/controls";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { clearHaptics, firedHaptics } from "@/test-helpers/hapticMock";
import { JEDDAH_CITY, RIYADH_CITY } from "@/test-helpers/place";
import { RIYADH_COORDS } from "@/test-helpers/prayerDay";
import { renderWithTheme } from "@/test-helpers/theme";
import { distanceBetween } from "@/utils/location";
import { markPoint } from "@/utils/cityCheck/marks";

const mockTrustedCityNear = jest.fn();

jest.mock("@/utils/cityCheck/cityNear", () => ({
  trustedCityNear: (...args: unknown[]) => mockTrustedCityNear(...args),
}));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

const FAR_MARK_KM = Math.round(distanceBetween(RIYADH_COORDS, markPoint(FAR_MARK)));

const renderSection = () => renderWithTheme(<TravelSection />);
const ASK_AGAIN_FIRST = new RegExp(`^${i18n.t("location.travel.notAsked.askAgain")}`);
const askAgainButton = () => screen.findByRole("button", { name: ASK_AGAIN_FIRST });

const radio = (title: ParseKeys) =>
  screen.getAllByRole("radio").find((row) => row.props.accessibilityLabel.startsWith(t(title)))!;

const notAskedHeader = () =>
  screen.queryByRole("header", { name: t("location.travel.notAsked.title") });

const hidden = { includeHiddenElements: true } as const;

/** A muted place of each kind; each setup returns the text its row shows. */
const MUTED_PLACES: readonly (readonly [string, () => string])[] = [
  [
    "a place on the city list",
    () => {
      mockTrustedCityNear.mockResolvedValue(JEDDAH_ROW);
      useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, notAsked: [JEDDAH_MARK] } });
      return JEDDAH_ROW.name;
    },
  ],
  [
    "a place off the list",
    () => {
      useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, notAsked: [FAR_MARK] } });
      return t("location.travel.notAsked.near", { distance: FAR_MARK_KM, saved: RIYADH_CITY.name });
    },
  ],
  [
    "a place off the list, from a saved place with no name",
    () => {
      unnamedSavedPlace();
      useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, notAsked: [FAR_MARK] } });
      return t("location.travel.notAsked.nearNoSavedName", { distance: FAR_MARK_KM });
    },
  ],
];

beforeEach(async () => {
  jest.clearAllMocks();
  clearHaptics();
  mockTrustedCityNear.mockResolvedValue(null);
  await act(() => i18n.changeLanguage(AppLocale.EN));
  savedRiyadh();
  useLocationStore.setState({ travelMode: TRAVEL_MODE.ASK });
  useCityCheckStore.setState({ cityCheck: EMPTY_MEMORY });
});

describe("the travel setting", () => {
  it("is a section headed by its label", async () => {
    await renderSection();

    expect(screen.getByRole("header", { name: t("location.settings.travelSection") })).toBeTruthy();
    expect(screen.getByLabelText(t("location.settings.travelSection"))).toHaveProp(
      "accessibilityRole",
      "radiogroup"
    );
  });

  it("offers asking, a coming-later update and no updates, in that order, as one radio group", async () => {
    await renderSection();

    expect(screen.getAllByRole("radio").map((row) => row.props.accessibilityLabel)).toEqual([
      t("a11y.join", {
        first: t("location.travel.ask.title"),
        second: t("location.travel.ask.note"),
      }),
      t("a11y.join", {
        first: t("location.travel.auto.title"),
        second: t("location.travel.comingLater"),
      }),
      t("a11y.join", {
        first: t("location.travel.off.title"),
        second: t("location.travel.off.note", { city: RIYADH_CITY.name }),
      }),
    ]);
  });

  it("says the times stay as they are for a saved place with no name", async () => {
    unnamedSavedPlace();
    await renderSection();

    expect(radio("location.travel.off.title")).toHaveProp(
      "accessibilityLabel",
      t("a11y.join", {
        first: t("location.travel.off.title"),
        second: t("location.travel.off.noteNoSavedName"),
      })
    );
  });

  it("marks the row for the current setting", async () => {
    await renderSection();

    expect(
      screen.getAllByRole("radio").map((row) => row.props.accessibilityState.selected)
    ).toEqual([true, false, false]);
  });

  it("holds Update by itself still", async () => {
    await renderSection();

    expect(radio("location.travel.auto.title")).toBeDisabled();
    await userEvent.setup().press(radio("location.travel.auto.title"));

    expect(useLocationStore.getState().travelMode).toBe(TRAVEL_MODE.ASK);
    expect(firedHaptics()).toEqual([]);
  });

  it.each<[TravelMode, ParseKeys]>([
    [TRAVEL_MODE.OFF, "location.travel.off.title"],
    [TRAVEL_MODE.ASK, "location.travel.ask.title"],
  ])("sets the travel setting to %s from its row, with a light haptic", async (mode, title) => {
    useLocationStore.setState({
      travelMode: mode === TRAVEL_MODE.ASK ? TRAVEL_MODE.OFF : TRAVEL_MODE.ASK,
    });
    await renderSection();

    await userEvent.setup().press(radio(title));

    expect(useLocationStore.getState().travelMode).toBe(mode);
    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.LIGHT]);
  });

  it("takes an offer down when updates are turned off", async () => {
    offerUp();
    await renderSection();

    await userEvent.setup().press(radio("location.travel.off.title"));

    expect(useLocationStore.getState().cityOffer).toBeNull();
  });
});

describe("the places not asked in", () => {
  it("lists no muted places while there are none", async () => {
    await renderSection();

    expect(notAskedHeader()).toBeNull();
  });

  it("names each muted place from the city list, else by its distance from the saved city", async () => {
    mockTrustedCityNear.mockImplementation(async (point) =>
      point.latitude === JEDDAH_MARK.lat ? JEDDAH_ROW : null
    );
    useCityCheckStore.setState({
      cityCheck: { ...EMPTY_MEMORY, notAsked: [JEDDAH_MARK, FAR_MARK] },
    });
    await renderSection();

    expect(notAskedHeader()).toBeTruthy();
    expect(await screen.findByText(JEDDAH_ROW.name, hidden)).toBeTruthy();
    expect(
      screen.getByText(
        t("location.travel.notAsked.near", { distance: FAR_MARK_KM, saved: RIYADH_CITY.name }),
        hidden
      )
    ).toBeTruthy();
  });

  it("measures from the saved city when it has no name", async () => {
    unnamedSavedPlace();
    useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, notAsked: [FAR_MARK] } });
    await renderSection();

    expect(
      await screen.findByText(
        t("location.travel.notAsked.nearNoSavedName", { distance: FAR_MARK_KM }),
        hidden
      )
    ).toBeTruthy();
  });

  it.each(MUTED_PLACES)("hides the row text of %s; its button says it", async (_kind, mute) => {
    const text = mute();
    await renderSection();

    expect((await screen.findByText(text, hidden)).props).toEqual(
      expect.objectContaining(HIDDEN_FROM_READER)
    );
    expect(await askAgainButton()).toHaveProp(
      "accessibilityLabel",
      t("a11y.join", { first: t("location.travel.notAsked.askAgain"), second: text })
    );
  });

  it.each(MUTED_PLACES)("hints at asking again in %s without the place", async (_kind, mute) => {
    mute();
    await renderSection();

    expect(await askAgainButton()).toHaveProp(
      "accessibilityHint",
      t("a11y.location.travel.askAgainThereHint")
    );
  });

  it("names the place in the label of its Ask again button", async () => {
    mockTrustedCityNear.mockResolvedValue(JEDDAH_ROW);
    useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, notAsked: [JEDDAH_MARK] } });
    await renderSection();

    expect(
      await screen.findByRole("button", {
        name: t("a11y.join", {
          first: t("location.travel.notAsked.askAgain"),
          second: JEDDAH_ROW.name,
        }),
      })
    ).toBeTruthy();
  });

  it("names the distance in the label of a place with no city row", async () => {
    useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, notAsked: [FAR_MARK] } });
    await renderSection();

    expect(
      await screen.findByRole("button", {
        name: t("a11y.join", {
          first: t("location.travel.notAsked.askAgain"),
          second: t("location.travel.notAsked.near", {
            distance: FAR_MARK_KM,
            saved: RIYADH_CITY.name,
          }),
        }),
      })
    ).toBeTruthy();
  });

  it("measures from the saved place while a new point waits for its times", async () => {
    useLocationStore.getState().setManualLocation(JEDDAH_CITY);
    useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, notAsked: [FAR_MARK] } });
    await renderSection();

    expect(
      await screen.findByText(
        t("location.travel.notAsked.near", { distance: FAR_MARK_KM, saved: RIYADH_CITY.name }),
        hidden
      )
    ).toBeTruthy();
  });

  it("measures the distance in the name when neither place has a name", async () => {
    unnamedSavedPlace();
    useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, notAsked: [FAR_MARK] } });
    await renderSection();

    expect(await askAgainButton()).toHaveProp(
      "accessibilityLabel",
      t("a11y.join", {
        first: t("location.travel.notAsked.askAgain"),
        second: t("location.travel.notAsked.nearNoSavedName", { distance: FAR_MARK_KM }),
      })
    );
  });

  it("asks again in a muted place, which leaves the list", async () => {
    useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, notAsked: [JEDDAH_MARK] } });
    await renderSection();

    await userEvent.setup().press(await askAgainButton());

    expect(useCityCheckStore.getState().cityCheck.notAsked).toEqual([]);
    expect(notAskedHeader()).toBeNull();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    useCityCheckStore.setState({ cityCheck: { ...EMPTY_MEMORY, notAsked: [JEDDAH_MARK] } });
    await renderSection();
    await askAgainButton();

    expect(controlProblems()).toEqual([]);
  });
});
