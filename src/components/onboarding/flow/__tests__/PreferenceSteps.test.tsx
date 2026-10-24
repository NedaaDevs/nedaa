import { PixelRatio } from "react-native";
import { act, screen, userEvent, waitFor, within } from "@testing-library/react-native";

import { AppearanceStep } from "@/components/onboarding/flow/steps/AppearanceStep";
import { NumeralsStep } from "@/components/onboarding/flow/steps/NumeralsStep";
import { TextSizeStep } from "@/components/onboarding/flow/steps/TextSizeStep";
import { BOWL_FRAME_PART } from "@/components/today/CelestialRhythm";
import { PRAYER_GRID_PART, PrayerGrid } from "@/components/today/PrayerGrid";
import { TODAY_STYLE_PREVIEW_PART } from "@/components/today/TodayStylePreview";
import { SkyBackground } from "@/components/ui/sky-background";
import { ThemeTransitionContext } from "@/components/ui/theme-transition/context";
import { APPEARANCE_ORDER } from "@/constants/Appearance";
import { CLOCK_SAMPLE } from "@/constants/Onboarding";
import { PHASE } from "@/constants/Phase";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { CLOCK_FORMAT } from "@/constants/Preferences";
import { nearestTextSize } from "@/constants/TextSize";
import { TODAY_STYLE } from "@/constants/Today";
import { PhaseContext } from "@/contexts/PhaseContext";
import { AppLocale, AppMode, TextSize } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { clearHaptics, HAPTIC } from "@/test-helpers/hapticMock";
import { lastPrimary, stepProps } from "@/test-helpers/onboardingStepProps";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { sampleDays } from "@/utils/sampleDays";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/utils/date", () => jest.requireActual("@/test-helpers/hijriDateMock"));
// The sky dims its bodies behind measured text; nothing is measured here.
jest.mock("@/utils/measureInWindow", () => ({ measureInWindow: () => Promise.resolve(null) }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

const t = i18n.t.bind(i18n);
const mockTransition = jest.fn(async (fn: () => void | Promise<void>) => {
  await fn();
});
let scaleSpy: jest.SpyInstance<number, []>;

beforeEach(async () => {
  await act(() => i18n.changeLanguage(AppLocale.EN));
  useAppStore.setState({ locale: AppLocale.EN, mode: AppMode.SYSTEM });
  usePreferencesStore.setState({
    use24HourTime: false,
    useWesternNumerals: true,
    textSize: TextSize.DEFAULT,
    textSizeOfferHandled: false,
  });
  mockTransition.mockClear();
  clearHaptics();
  usePrayerTimesStore.setState({ todayTimings: null, usingDefaultLocation: false });
  scaleSpy = jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1);
});
afterEach(() => jest.restoreAllMocks());

describe("NumeralsStep", () => {
  it("hides the numerals control outside Arabic", async () => {
    await renderWithTheme(<NumeralsStep {...stepProps()} />);

    expect(screen.queryByLabelText(t("settings.preferences.numerals.title"))).toBeNull();
    expect(screen.getByLabelText(t("settings.preferences.clock.title"))).toBeTruthy();
  });

  it("stores the Western-digits choice in Arabic", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    usePreferencesStore.setState({ useWesternNumerals: false });
    await renderWithTheme(<NumeralsStep {...stepProps()} />);

    await userEvent.press(
      screen.getByRole("radio", { name: t("settings.preferences.numerals.spoken.western") })
    );

    expect(usePreferencesStore.getState().useWesternNumerals).toBe(true);
    expect(HAPTIC.selection).toHaveBeenCalledTimes(1);
  });

  it("shows the numerals control in Arabic", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    await renderWithTheme(<NumeralsStep {...stepProps()} />);

    expect(screen.getByLabelText(t("settings.preferences.numerals.title"))).toBeTruthy();
  });

  it("applies the clock choice at once, and the sample follows it", async () => {
    await renderWithTheme(<NumeralsStep {...stepProps()} />);
    expect(screen.queryByText(/16:35/)).toBeNull();

    await userEvent.press(
      screen.getByRole("radio", { name: t("settings.preferences.clock.spoken.24h") })
    );

    expect(usePreferencesStore.getState().use24HourTime).toBe(true);
    expect(screen.getByText(/16:35/)).toBeTruthy();
    expect(HAPTIC.selection).toHaveBeenCalledTimes(1);
  });

  // Arabic writes «ص» after the digits; the whole time is not one LTR run.
  it("writes the sample as Today's prayer grid writes the same time", async () => {
    // A day whose Fajr is the sample's moment; the other times differ from it.
    const at = (time: string) => `2026-01-01T${time}:00.000Z`;
    const day: DayPrayerTimes = {
      date: 20260101,
      timezone: CLOCK_SAMPLE.TIMEZONE,
      timings: {
        [PRAYER_ID.FAJR]: CLOCK_SAMPLE.ISO,
        [PRAYER_ID.DHUHR]: at("17:00"),
        [PRAYER_ID.ASR]: at("18:00"),
        [PRAYER_ID.MAGHRIB]: at("19:00"),
        [PRAYER_ID.ISHA]: at("20:00"),
      },
      otherTimings: { [OTHER_TIMING.SUNRISE]: at("16:50") } as DayPrayerTimes["otherTimings"],
    };
    await act(() => i18n.changeLanguage(AppLocale.AR));
    useAppStore.setState({ locale: AppLocale.AR });
    usePreferencesStore.setState({ useWesternNumerals: false });
    usePrayerTimesStore.setState({ todayTimings: day });
    await renderWithTheme(
      <>
        <NumeralsStep {...stepProps()} />
        <PrayerGrid onSelect={jest.fn()} />
      </>,
      { isRTL: true }
    );

    const card = screen.getByLabelText(new RegExp(t("onboarding.numerals.sample")));
    const sample = within(card).getByText(/[٠-٩]/);
    expect(screen.getAllByText(String(sample.props.children))).toHaveLength(2);
  });

  // The segmented control reports no change for the format already chosen.
  it("does not tick when the chosen clock format is pressed", async () => {
    await renderWithTheme(<NumeralsStep {...stepProps()} />);

    await userEvent.press(
      screen.getByRole("radio", {
        name: t(`settings.preferences.clock.spoken.${CLOCK_FORMAT.TWELVE_HOUR}`),
      })
    );

    expect(HAPTIC.selection).not.toHaveBeenCalled();
  });
});

describe("AppearanceStep", () => {
  const renderAppearance = () =>
    renderWithTheme(
      <ThemeTransitionContext value={mockTransition}>
        <PhaseContext value={PHASE.ASR}>
          <SkyBackground>
            <AppearanceStep {...stepProps()} />
          </SkyBackground>
        </PhaseContext>
      </ThemeTransitionContext>
    );
  const rowName = (mode: AppMode) =>
    t("a11y.join", {
      first: t(`settings.themes.${mode}.title`),
      second: t(`settings.themes.${mode}.description`),
    });

  const styleNames = Object.values(TODAY_STYLE).map((style) =>
    t(`settings.preferences.todayStyle.options.${style}`)
  );
  const hidden = { includeHiddenElements: true };
  const SAMPLE_DAY = sampleDays(new Date()).today ?? null;

  beforeEach(() => usePreferencesStore.setState({ todayStyle: TODAY_STYLE.BOWL }));

  it("offers the four modes in the Settings order and no colour family", async () => {
    await renderAppearance();

    expect(
      screen
        .getAllByRole("radio")
        .map((row) => row.props.accessibilityLabel)
        .filter((name) => !styleNames.includes(name))
    ).toEqual(APPEARANCE_ORDER.map(rowName));
  });

  it("offers Today's two styles, the bowl chosen", async () => {
    await renderAppearance();
    const group = screen.getByLabelText(t("settings.preferences.todayStyle.title"));

    expect(group.props.accessibilityRole).toBe("radiogroup");
    expect(
      within(group)
        .getAllByRole("radio")
        .map((r) => r.props.accessibilityLabel)
    ).toEqual(styleNames);
    expect(screen.getByRole("radio", { name: styleNames[0] })).toBeSelected();
  });

  // Before the user's times exist, the preview draws a sample day and says so.
  it("previews the bowl on a sample day before any times are stored", async () => {
    await renderAppearance();

    expect(screen.getByTestId(BOWL_FRAME_PART.FRAME, hidden)).toBeTruthy();
    expect(screen.getByTestId(TODAY_STYLE_PREVIEW_PART.SAMPLE_NOTE)).toHaveTextContent(
      t("onboarding.appearance.sampleTimes")
    );
    expect(screen.queryByTestId(TODAY_STYLE_PREVIEW_PART.ROOT)).toBeNull();
  });

  it("previews the simple style once chosen, its lit card carrying the bar", async () => {
    await renderAppearance();

    await userEvent.press(screen.getByRole("radio", { name: styleNames[1] }));

    expect(usePreferencesStore.getState().todayStyle).toBe(TODAY_STYLE.SIMPLE);
    expect(screen.queryByTestId(BOWL_FRAME_PART.FRAME, hidden)).toBeNull();
    expect(screen.getAllByTestId(PRAYER_GRID_PART.BAR, hidden)).toHaveLength(1);
  });

  // Times for the default place are not the user's either.
  it("keeps the sample over the default place's times", async () => {
    usePrayerTimesStore.setState({ todayTimings: SAMPLE_DAY, usingDefaultLocation: true });
    await renderAppearance();

    expect(screen.getByTestId(TODAY_STYLE_PREVIEW_PART.SAMPLE_NOTE)).toBeTruthy();
  });

  it("previews the user's own times once stored, with no sample note", async () => {
    usePrayerTimesStore.setState({ todayTimings: SAMPLE_DAY, usingDefaultLocation: false });
    await renderAppearance();

    expect(screen.queryByTestId(TODAY_STYLE_PREVIEW_PART.SAMPLE_NOTE)).toBeNull();
    expect(screen.getByTestId(TODAY_STYLE_PREVIEW_PART.ROOT)).toBeTruthy();
  });

  it("applies a mode through the theme dissolve", async () => {
    await renderAppearance();

    await userEvent.press(screen.getByRole("radio", { name: rowName(AppMode.DARK) }));

    await waitFor(() => expect(useAppStore.getState().mode).toBe(AppMode.DARK));
    expect(mockTransition).toHaveBeenCalledTimes(1);
    expect(HAPTIC.selection).toHaveBeenCalledTimes(1);
  });
});

describe("TextSizeStep", () => {
  it("headlines the choice, not the device's large text", async () => {
    await renderWithTheme(<TextSizeStep {...stepProps()} />);

    expect(screen.getByText(t("onboarding.textSize.chooseTitle"))).toBeTruthy();
    expect(screen.getByText(t("onboarding.textSize.chooseBody"))).toBeTruthy();
  });

  it("sets the text size", async () => {
    await renderWithTheme(<TextSizeStep {...stepProps()} />);

    await userEvent.press(
      screen.getByRole("radio", { name: t("settings.textSize.options.large") })
    );

    expect(usePreferencesStore.getState().textSize).toBe(TextSize.LARGE);
    expect(HAPTIC.selection).toHaveBeenCalledTimes(1);
  });

  it("preselects the size nearest the phone's large text, with no tick", async () => {
    scaleSpy.mockReturnValue(1.3);
    await renderWithTheme(<TextSizeStep {...stepProps()} />);

    expect(usePreferencesStore.getState().textSize).toBe(nearestTextSize(1.3));
    expect(HAPTIC.selection).not.toHaveBeenCalled();
  });

  it("leaves the size alone once the offer is handled", async () => {
    scaleSpy.mockReturnValue(1.3);
    usePreferencesStore.setState({ textSizeOfferHandled: true });
    await renderWithTheme(<TextSizeStep {...stepProps()} />);

    expect(usePreferencesStore.getState().textSize).toBe(TextSize.DEFAULT);
  });

  it("keeps the default at the phone's normal text size", async () => {
    await renderWithTheme(<TextSizeStep {...stepProps()} />);

    expect(usePreferencesStore.getState().textSize).toBe(TextSize.DEFAULT);
    expect(usePreferencesStore.getState().textSizeOfferHandled).toBe(false);
  });

  it("continues with the offer marked handled", async () => {
    const props = stepProps();
    await renderWithTheme(<TextSizeStep {...props} />);

    await act(async () => lastPrimary(props.setPrimary)?.onPress());

    expect(usePreferencesStore.getState().textSizeOfferHandled).toBe(true);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });
});
