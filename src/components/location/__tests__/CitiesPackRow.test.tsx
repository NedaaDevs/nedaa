import { AccessibilityInfo, Platform } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import CitiesPackRow, { CITIES_PACK_PART } from "@/components/location/CitiesPackRow";
import {
  CITIES_FULL_CITY_COUNT,
  CITIES_PACK_BYTES,
  CITIES_SEED_CITY_COUNT,
} from "@/constants/Cities";
import { AppLocale, PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useCitiesPackStore } from "@/stores/citiesPack";
import { usePreferencesStore } from "@/stores/preferences";
import { clearHaptics, HAPTIC } from "@/test-helpers/hapticMock";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/services/cities-download", () => ({ downloadCitiesPack: jest.fn() }));
jest.mock("@/services/cities-db", () => ({
  isFullPackInstalled: () => false,
  invalidateCitiesDb: jest.fn(),
}));

const t = i18n.t.bind(i18n);
const PLATFORM = Platform.OS;
const NUMERALS = usePreferencesStore.getState().useWesternNumerals;
const download = jest.fn(async () => {});
const cancel = jest.fn();

const LIGHT = config.themes.light;
const seedNote = () =>
  t("location.picker.seedCoverage", { count: CITIES_SEED_CITY_COUNT, amount: "2,500" });

beforeEach(async () => {
  jest.clearAllMocks();
  clearHaptics();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  useCitiesPackStore.setState({
    isInstalled: false,
    isDownloading: false,
    receivedBytes: 0,
    totalBytes: 0,
    error: null,
    download,
    cancel,
  });
});

afterEach(() => {
  Platform.OS = PLATFORM;
  usePreferencesStore.setState({ useWesternNumerals: NUMERALS });
  jest.restoreAllMocks();
});

describe("CitiesPackRow", () => {
  it("says what search covers, and offers the full list with its size", async () => {
    await renderWithTheme(<CitiesPackRow />);

    expect(screen.getByText("Search covers 2,500 major cities for now.")).toBeTruthy();
    expect(screen.getByTestId(CITIES_PACK_PART.OFFER)).toHaveAccessibleName(
      t("a11y.join", {
        first: t("location.picker.packDownload"),
        second: t("location.picker.packDetail", {
          count: CITIES_FULL_CITY_COUNT,
          amount: "69,537",
          size: "6.1",
        }),
      })
    );
  });

  // The note sits on the bare sky, where the plain muted ink falls to 3:1.
  it("writes the coverage note in the ink kept for the sky", async () => {
    await renderWithTheme(<CitiesPackRow />);

    expect(screen.getByText(seedNote())).toHaveStyle({ color: LIGHT.mutedSky.val });
  });

  it("starts the download from the offer, with a firm tap", async () => {
    await renderWithTheme(<CitiesPackRow />);

    await userEvent.press(screen.getByTestId(CITIES_PACK_PART.OFFER));

    expect(download).toHaveBeenCalledTimes(1);
    expect(HAPTIC.medium).toHaveBeenCalledTimes(1);
  });

  it("says the download has started", async () => {
    Platform.OS = PlatformType.IOS;
    const say = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    useCitiesPackStore.setState({ isDownloading: true });
    await renderWithTheme(<CitiesPackRow />);

    const title = t("location.picker.packDownloading");
    expect(say).toHaveBeenCalledWith(title);
    expect(screen.getByText(title).props.accessibilityLiveRegion).toBe("polite");
  });

  // The row leaves once the list lands, so the start of it says the end.
  it("says the full list is ready once it is installed", async () => {
    const say = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    download.mockImplementationOnce(async () => {
      useCitiesPackStore.setState({ isInstalled: true });
    });
    await renderWithTheme(<CitiesPackRow />);

    await userEvent.press(screen.getByTestId(CITIES_PACK_PART.OFFER));

    expect(say).toHaveBeenCalledWith(t("location.picker.packInstalled"));
  });

  it("says nothing is ready when the download does not install", async () => {
    const say = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await renderWithTheme(<CitiesPackRow />);

    await userEvent.press(screen.getByTestId(CITIES_PACK_PART.OFFER));

    expect(say).not.toHaveBeenCalledWith(t("location.picker.packInstalled"));
  });

  it("shows the download's progress, and cancels it", async () => {
    useCitiesPackStore.setState({
      isDownloading: true,
      receivedBytes: 2_400_000,
      totalBytes: CITIES_PACK_BYTES,
    });
    await renderWithTheme(<CitiesPackRow />);

    expect(screen.getByText(t("location.picker.packDownloading"))).toBeTruthy();
    expect(
      screen.getByText(t("location.picker.packProgress", { received: "2.4", total: "6.1" }))
    ).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: t("location.picker.packDownloading") }).props
        .accessibilityValue
    ).toEqual({ min: 0, max: 100, now: 40 });
    expect(screen.queryByTestId(CITIES_PACK_PART.OFFER)).toBeNull();

    await userEvent.press(
      screen.getByRole("button", { name: t("a11y.location.picker.cancelDownload") })
    );
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("says a failed download in words, retries it, and keeps the major cities", async () => {
    Platform.OS = PlatformType.IOS;
    const say = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    useCitiesPackStore.setState({ error: "Network request failed" });
    await renderWithTheme(<CitiesPackRow />);

    const failure = t("location.picker.packFailedBody");
    expect(screen.getByLabelText(failure)).toBeTruthy();
    expect(say).toHaveBeenCalledWith(failure);
    expect(screen.queryByText("Network request failed")).toBeNull();
    expect(screen.getByText(seedNote())).toBeTruthy();

    await userEvent.press(screen.getByRole("button", { name: t("common.retry") }));
    expect(download).toHaveBeenCalledTimes(1);
    expect(HAPTIC.medium).toHaveBeenCalledTimes(1);
  });

  it.each([
    [true, "تضم 69,537 مدينة، وحجمها 6.1 ميغابايت", "يقتصر البحث حاليًا على 2,500 مدينة رئيسية."],
    [false, "تضم ٦٩٬٥٣٧ مدينة، وحجمها ٦.١ ميغابايت", "يقتصر البحث حاليًا على ٢٬٥٠٠ مدينة رئيسية."],
  ])(
    "groups the counts and states the size in Arabic (Western numerals: %p)",
    async (western, detail, coverage) => {
      usePreferencesStore.setState({ useWesternNumerals: western });
      await act(() => i18n.changeLanguage(AppLocale.AR));
      await renderWithTheme(<CitiesPackRow />, { isRTL: true });

      expect(screen.getByText(detail)).toBeTruthy();
      expect(screen.getByText(coverage)).toBeTruthy();
    }
  );
});
