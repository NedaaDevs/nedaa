import { AccessibilityInfo, Platform, StyleSheet } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import CoordinateEntry, { NEAREST_LOOKUP_DEBOUNCE_MS } from "@/components/location/CoordinateEntry";
import { CALLOUT_PART } from "@/components/ui/callout";
import { UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import { AppLocale, PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { CitiesDB } from "@/services/cities-db";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import type { NearestCity } from "@/types/cities";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/services/cities-db", () => ({ CitiesDB: { findNearestCity: jest.fn() } }));

const t = i18n.t.bind(i18n);
const PLATFORM = Platform.OS;
const NUMERALS = usePreferencesStore.getState().useWesternNumerals;
const NO_NAMES = { ar: null, ur: null, ms: null };

const MAKKAH: NearestCity = {
  city: {
    gid: 104515,
    name: "Makkah",
    names: { ...NO_NAMES, ar: "مكة المكرمة" },
    latitude: 21.4267,
    longitude: 39.8261,
    countryCode: "SA",
    country: { name: "Saudi Arabia", names: NO_NAMES },
    region: null,
    population: 1,
    timezone: "Asia/Riyadh",
  },
  distanceKm: 0.46,
};

const findNearest = jest.mocked(CitiesDB.findNearestCity);
const latitudeField = () => screen.getByLabelText(t("a11y.location.coordinates.latitude"));
const longitudeField = () => screen.getByLabelText(t("a11y.location.coordinates.longitude"));
const save = () => screen.getByRole("button", { name: t("a11y.location.coordinates.save") });
const nearestCity = () => t("location.coordinates.nearestCity", { city: "Makkah" });
const nearestDetail = () =>
  t("location.coordinates.nearestDetail", { distance: "0", timezone: "Asia/Riyadh" });
const resolved = () => t("a11y.join", { first: nearestCity(), second: nearestDetail() });

const renderEntry = async ({ isRTL = false } = {}) => {
  const onSave = jest.fn();
  await renderWithTheme(<CoordinateEntry onSave={onSave} />, { isRTL });
  return onSave;
};

/** Waits out the pause before a lookup, then lets it answer. */
const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, NEAREST_LOOKUP_DEBOUNCE_MS + 10)));

/** Types into both fields, then lets the lookup settle. */
const enter = async (latitude: string, longitude: string) => {
  await userEvent.type(latitudeField(), latitude);
  await userEvent.type(longitudeField(), longitude);
  await settle();
};

beforeEach(async () => {
  jest.clearAllMocks();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  findNearest.mockResolvedValue(MAKKAH);
  useLocationUpdateStore.setState({ run: null });
});

afterEach(() => {
  Platform.OS = PLATFORM;
  usePreferencesStore.setState({ useWesternNumerals: NUMERALS });
  jest.restoreAllMocks();
});

describe("CoordinateEntry", () => {
  // The description sits on the bare sky, where plain muted ink falls to 3:1.
  it("writes its description in the ink kept for the sky", async () => {
    await renderEntry();

    expect(screen.getByText(t("location.coordinates.description"))).toHaveStyle({
      color: config.themes.light.mutedSky.val,
    });
  });

  it("names each field and its range, and holds Save until both are typed", async () => {
    await renderEntry();

    expect(screen.getByText(t("location.coordinates.latitudeRange"))).toBeTruthy();
    expect(screen.getByText(t("location.coordinates.longitudeRange"))).toBeTruthy();
    expect(save()).toBeDisabled();
    expect(findNearest).not.toHaveBeenCalled();
  });

  it("takes Arabic-Indic digits and the Arabic decimal mark, and shows them Western", async () => {
    await renderEntry({ isRTL: true });

    await enter("٢١٫٤٢٢٥", "٣٩٫٨٢٦٢");

    expect(latitudeField().props.value).toBe("21.4225");
    expect(longitudeField().props.value).toBe("39.8262");
    expect(findNearest).toHaveBeenCalledWith(21.4225, 39.8262);
  });

  it("says a latitude past the poles is out of range, and says it aloud", async () => {
    Platform.OS = PlatformType.IOS;
    const say = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await renderEntry();

    await enter("95", "39.8");

    const error = t("location.coordinates.latitudeInvalid");
    expect(screen.getByLabelText(error)).toBeTruthy();
    expect(say).toHaveBeenCalledWith(error);
    expect(latitudeField().props.accessibilityHint).toBe(error);
    expect(save()).toBeDisabled();
    expect(findNearest).not.toHaveBeenCalled();
  });

  it("says a longitude past the antimeridian is out of range", async () => {
    await renderEntry();

    await enter("21.4", "181");

    expect(screen.getByLabelText(t("location.coordinates.longitudeInvalid"))).toBeTruthy();
  });

  it("asks for a number where the text is not one", async () => {
    await renderEntry();

    await enter("north", "39.8.262");

    expect(screen.getByLabelText(t("location.coordinates.latitudeNotNumber"))).toBeTruthy();
    expect(screen.getByLabelText(t("location.coordinates.longitudeNotNumber"))).toBeTruthy();
  });

  it("shows no error while a number is part-way typed", async () => {
    await renderEntry();

    await enter("-", "24.");

    expect(screen.queryByLabelText(t("location.coordinates.latitudeNotNumber"))).toBeNull();
    expect(screen.queryByLabelText(t("location.coordinates.longitudeNotNumber"))).toBeNull();
    expect(save()).toBeDisabled();
  });

  it("shows it is finding the nearest city while the lookup runs, and says nothing", async () => {
    Platform.OS = PlatformType.IOS;
    const say = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    findNearest.mockReturnValue(new Promise(() => {}));
    await renderEntry();

    await enter("21.4225", "39.8262");

    expect(screen.getByLabelText(t("location.coordinates.resolving"))).toBeTruthy();
    expect(save()).toBeDisabled();
    expect(say).not.toHaveBeenCalled();
  });

  // Each keystroke would otherwise say the wait, then a new distance.
  it("looks up and says the nearest city once the typing stops", async () => {
    Platform.OS = PlatformType.IOS;
    const say = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await renderEntry();

    await enter("21.4225", "39.8262");

    expect(findNearest).toHaveBeenCalledTimes(1);
    expect(say.mock.calls).toEqual([[nearestCity()]]);
    expect(screen.getByLabelText(resolved()).props.accessibilityLiveRegion).toBe("none");

    // A digit more that keeps the same city says nothing new.
    await userEvent.type(longitudeField(), "1");
    await settle();
    expect(findNearest).toHaveBeenCalledTimes(2);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it("previews the nearest city, then hands the typed place to its host", async () => {
    const onSave = await renderEntry();

    await enter("21.4225", "39.8262");
    expect(screen.getByLabelText(resolved())).toBeTruthy();
    // The city on its own line, its distance and zone under it, by a pin.
    expect(screen.getByText(nearestCity())).toBeTruthy();
    expect(screen.getByText(nearestDetail())).toBeTruthy();
    expect(
      screen.getByTestId(CALLOUT_PART.ICON_PLACE, { includeHiddenElements: true })
    ).toBeTruthy();
    await userEvent.press(save());

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: null,
        name: "Makkah",
        latitude: 21.4225,
        longitude: 39.8262,
        timezone: "Asia/Riyadh",
      })
    );
  });

  // The preview's digits match the fields under either numeral choice.
  it("writes the preview's numbers in Western digits in Arabic", async () => {
    usePreferencesStore.setState({ useWesternNumerals: false });
    await act(() => i18n.changeLanguage(AppLocale.AR));
    await renderEntry({ isRTL: true });

    await enter("21.4225", "39.8262");

    expect(screen.getByText("أقرب مدينة: \u2068مكة المكرمة\u2069")).toBeTruthy();
    expect(screen.getByText("على بُعد 0 كم · \u2066Asia/Riyadh\u2069")).toBeTruthy();
    expect(screen.getByText("من ⁦-90⁩ إلى 90")).toBeTruthy();
  });

  it("says no city is near enough to take a time zone from", async () => {
    const say = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    findNearest.mockResolvedValue(null);
    await renderEntry();

    await enter("0", "-160");

    const none = t("location.coordinates.noNearbyCity");
    expect(screen.getByLabelText(none)).toBeTruthy();
    expect(say.mock.calls).toEqual([[none]]);
    expect(save()).toBeDisabled();
  });

  it("says a failed lookup in words, and looks again on retry", async () => {
    const say = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    findNearest.mockRejectedValue(new Error("SQLITE_CANTOPEN"));
    await renderEntry();

    await enter("21.4225", "39.8262");
    const failed = findNearest.mock.calls.length;
    findNearest.mockResolvedValue(MAKKAH);
    expect(screen.getByLabelText(t("location.coordinates.lookupFailed"))).toBeTruthy();
    expect(say).toHaveBeenCalledWith(t("location.coordinates.lookupFailed"));
    expect(screen.queryByText(/SQLITE/)).toBeNull();
    expect(save()).toBeDisabled();

    await userEvent.press(screen.getByRole("button", { name: t("common.retry") }));
    await settle();

    expect(findNearest).toHaveBeenCalledTimes(failed + 1);
    expect(findNearest).toHaveBeenLastCalledWith(21.4225, 39.8262);
    expect(screen.getByLabelText(resolved())).toBeTruthy();
  });

  it("holds Save while an update runs", async () => {
    useLocationUpdateStore.setState({
      run: { start: { kind: UPDATE_START.DEVICE }, step: UPDATE_STEP.LOCATION, failed: false },
    });
    await renderEntry();

    await enter("21.4225", "39.8262");

    expect(save()).toBeDisabled();
  });

  // numbers-and-punctuation is iOS only; Android's numeric pad has the sign.
  it.each([
    [PlatformType.IOS, "numbers-and-punctuation"],
    [PlatformType.ANDROID, "numeric"],
  ])("opens a keyboard with digits, a sign and a decimal mark on %s", async (os, keyboard) => {
    Platform.OS = os;
    await renderEntry();

    expect(latitudeField().props.keyboardType).toBe(keyboard);
    expect(longitudeField().props.keyboardType).toBe(keyboard);
  });

  // A sign has no direction of its own: in RTL "-33.8" would read "33.8-".
  it("keeps a signed number left to right, against the start edge, in Arabic", async () => {
    await renderEntry({ isRTL: true });

    await userEvent.type(latitudeField(), "-33.8");

    const style = StyleSheet.flatten(latitudeField().props.style);
    expect(latitudeField().props.value).toBe("-33.8");
    expect(style.textAlign).toBe("right");
    expect(style.direction).toBe("ltr");
    expect(style.writingDirection).toBe("ltr");
  });
});
