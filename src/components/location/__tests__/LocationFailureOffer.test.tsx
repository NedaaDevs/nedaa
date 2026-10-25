import { Linking, Platform, StyleSheet } from "react-native";
import { screen, userEvent, within } from "@testing-library/react-native";

import {
  LOCATION_FAILURE_PART,
  LocationFailureOffer,
} from "@/components/location/LocationFailureOffer";
import { E2E_ID } from "@/constants/E2E";
import { DEFAULT_FACES } from "@/constants/Fonts";
import {
  ANDROID_LOCATION_SETTINGS,
  LOCATION_FAILURE,
  type LocationFailure,
} from "@/constants/Location";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { usesHmsLocation } from "@/adapters/location";

jest.mock("@/adapters/location", () => ({
  ...jest.requireActual("@/adapters/location"),
  usesHmsLocation: jest.fn(() => false),
}));

const t = i18n.t.bind(i18n);
const PLATFORM = Platform.OS;

type Handlers = { onRetry: jest.Mock; onChooseCity: jest.Mock; onEnterCoordinates: jest.Mock };

const renderOffer = async (failure: LocationFailure | null, { inSheet = false } = {}) => {
  const handlers: Handlers = {
    onRetry: jest.fn(),
    onChooseCity: jest.fn(),
    onEnterCoordinates: jest.fn(),
  };
  await renderWithTheme(<LocationFailureOffer failure={failure} inSheet={inSheet} {...handlers} />);
  return handlers;
};

/** The panel's one announced message: what failed, then what to do. */
const message = (title: string, hint: string) => screen.getByLabelText(`${t(title)}. ${t(hint)}`);
const styleOf = (element: ReturnType<typeof screen.getByRole>) =>
  StyleSheet.flatten(element.props.style);

afterEach(() => {
  Platform.OS = PLATFORM;
  jest.mocked(usesHmsLocation).mockReturnValue(false);
});

describe("LocationFailureOffer", () => {
  it.each([
    [LOCATION_FAILURE.TIMEOUT, "location.failure.notFound"],
    [LOCATION_FAILURE.UNAVAILABLE, "location.failure.notFound"],
    [LOCATION_FAILURE.DENIED, "location.failure.denied"],
  ] as const)("says what a %s failure means and what to do", async (failure, copy) => {
    await renderOffer(failure);

    expect(message(`${copy}.title`, `${copy}.hint`)).toBeTruthy();
  });

  it("names the Huawei location service when it is the one that failed", async () => {
    jest.mocked(usesHmsLocation).mockReturnValue(true);
    await renderOffer(LOCATION_FAILURE.UNAVAILABLE);

    expect(message("location.failure.hms.title", "location.failure.hms.hint")).toBeTruthy();
  });

  it("says the times failed, not the place, when the read succeeded", async () => {
    await renderOffer(null);

    expect(message("today.failed.title", "today.failed.body")).toBeTruthy();
  });

  describe("location services off", () => {
    it("on iOS, says where to turn them on, with no button for it", async () => {
      Platform.OS = PlatformType.IOS;
      await renderOffer(LOCATION_FAILURE.SERVICES_OFF);

      expect(
        message("location.failure.servicesOff.title", "location.failure.servicesOff.hintIos")
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: t("location.failure.servicesOff.open") })
      ).toBeNull();
    });

    it("on Android, opens the location settings page", async () => {
      Platform.OS = PlatformType.ANDROID;
      const sendIntent = jest.spyOn(Linking, "sendIntent").mockResolvedValue(undefined);
      await renderOffer(LOCATION_FAILURE.SERVICES_OFF);

      expect(
        message("location.failure.servicesOff.title", "location.failure.servicesOff.hintAndroid")
      ).toBeTruthy();
      const open = screen.getByRole("button", { name: t("location.failure.servicesOff.open") });
      expect(open).toHaveProp("accessibilityHint", t("a11y.location.openLocationSettingsHint"));
      await userEvent.press(open);

      expect(sendIntent).toHaveBeenCalledWith(ANDROID_LOCATION_SETTINGS);
    });

    // Retry leads; the settings button follows it, lighter, on the same card.
    it("on Android, puts the settings button under Retry, on its card, as an outline", async () => {
      Platform.OS = PlatformType.ANDROID;
      await renderOffer(LOCATION_FAILURE.SERVICES_OFF);

      const card = screen.getByTestId(LOCATION_FAILURE_PART.CARD);
      const [retry, open] = within(card).getAllByRole("button");
      expect(retry).toHaveAccessibleName(t("common.retry"));
      expect(open).toHaveAccessibleName(t("location.failure.servicesOff.open"));
      expect(styleOf(open).backgroundColor).not.toBe(NEDAA_LIGHT.accent.hex);
      expect(styleOf(open).minHeight).toBe(styleOf(retry).minHeight);
    });
  });

  it("retries first", async () => {
    const { onRetry } = await renderOffer(LOCATION_FAILURE.TIMEOUT);
    const buttons = screen.getAllByRole("button");

    expect(buttons[0]).toHaveAccessibleName(t("common.retry"));
    await userEvent.press(buttons[0]);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // The study's failure card: the reason, then a full-width filled Retry.
  it("sets the reason and a filled Retry on one card", async () => {
    await renderOffer(LOCATION_FAILURE.TIMEOUT);

    const card = screen.getByTestId(LOCATION_FAILURE_PART.CARD);
    expect(
      within(card).getByLabelText(
        `${t("location.failure.notFound.title")}. ${t("location.failure.notFound.hint")}`
      )
    ).toBeTruthy();
    const retry = within(card).getByRole("button", { name: t("common.retry") });
    expect(styleOf(retry).backgroundColor).toBe(NEDAA_LIGHT.accent.hex);
    expect(styleOf(retry).alignSelf).not.toBe("center");
  });

  // Weight 700 is for display and title text; a card's name tops out at 600.
  it("names the failure in the semibold face", async () => {
    await renderOffer(LOCATION_FAILURE.TIMEOUT);

    expect(screen.getByText(t("location.failure.notFound.title"))).toHaveStyle({
      fontFamily: DEFAULT_FACES.semibold,
    });
  });

  // A sheet stacks two tones and never lays glass on glass.
  it("lies flat on the panel tone inside a sheet", async () => {
    await renderOffer(LOCATION_FAILURE.TIMEOUT, { inSheet: true });

    expect(screen.getByTestId(LOCATION_FAILURE_PART.CARD)).toHaveStyle({
      backgroundColor: NEDAA_LIGHT.panel.hex,
    });
  });

  it("offers the manual ways under their own label", async () => {
    await renderOffer(LOCATION_FAILURE.TIMEOUT);

    expect(screen.getByRole("header", { name: t("location.failure.otherWays") })).toBeTruthy();
  });

  it("chooses a city from the control the CI flow taps", async () => {
    const { onChooseCity } = await renderOffer(LOCATION_FAILURE.TIMEOUT);
    const row = screen.getByTestId(E2E_ID.LOCATION_CHOOSE_CITY);

    expect(row).toHaveAccessibleName(
      t("a11y.join", {
        first: t("onboarding.location.chooseCity"),
        second: t("location.failure.chooseCityNote"),
      })
    );
    expect(row).toHaveProp("accessibilityHint", t("a11y.location.manual.chooseCityHint"));
    await userEvent.press(row);
    expect(onChooseCity).toHaveBeenCalledTimes(1);
  });

  it("enters coordinates for a place the list lacks", async () => {
    const { onEnterCoordinates } = await renderOffer(LOCATION_FAILURE.TIMEOUT);
    const name = t("a11y.join", {
      first: t("location.picker.enterCoordinates"),
      second: t("location.failure.coordinatesNote"),
    });
    const row = screen.getByRole("button", { name });

    expect(row).toHaveProp("accessibilityHint", t("a11y.location.picker.enterCoordinatesHint"));
    await userEvent.press(row);
    expect(onEnterCoordinates).toHaveBeenCalledTimes(1);
  });
});
