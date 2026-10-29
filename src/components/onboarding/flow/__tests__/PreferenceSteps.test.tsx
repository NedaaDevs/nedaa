import type { ReactNode } from "react";
import { AccessibilityInfo, PixelRatio, StyleSheet } from "react-native";
import { act, screen, userEvent, waitFor, within } from "@testing-library/react-native";

import { DAY_RUN_PLAYER_PART, DayRunPlayer } from "@/components/onboarding/flow/DayRunPlayer";
import { PLAY_DAY_PART } from "@/components/onboarding/flow/PlayDayButton";
import { AppearanceStep } from "@/components/onboarding/flow/steps/AppearanceStep";
import { NumeralsStep } from "@/components/onboarding/flow/steps/NumeralsStep";
import { TextSizeStep } from "@/components/onboarding/flow/steps/TextSizeStep";
import { BOWL_FRAME_PART } from "@/components/today/CelestialRhythm";
import { DaySimulator } from "@/components/today/DaySimulator";
import { PRAYER_GRID_PART, PrayerGrid } from "@/components/today/PrayerGrid";
import { TODAY_STYLE_PREVIEW_PART } from "@/components/today/TodayStylePreview";
import { SkyBackground } from "@/components/ui/sky-background";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { SKY_SWATCH_ID } from "@/components/ui/sky-preview";
import { ThemeTransitionContext } from "@/components/ui/theme-transition/context";
import { APPEARANCE_ORDER, PIN_REPORT_LIMIT_MS } from "@/constants/Appearance";
import { DAY_RUN, DAY_RUN_KIND, DAY_RUN_STATUS } from "@/constants/DayRun";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { CLOCK_SAMPLE, ONBOARDING_PART } from "@/constants/Onboarding";
import { PHASE } from "@/constants/Phase";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { CLOCK_FORMAT } from "@/constants/Preferences";
import { nearestTextSize } from "@/constants/TextSize";
import { TODAY_STYLE } from "@/constants/Today";
import { DayRunContext, useDayRun, type DayRun } from "@/contexts/DayRunContext";
import { PhaseContext } from "@/contexts/PhaseContext";
import { AppLocale, AppMode, TextSize } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { controlProblems } from "@/test-helpers/controls";
import { clearHaptics, HAPTIC } from "@/test-helpers/hapticMock";
import { lastPrimary, stepProps } from "@/test-helpers/onboardingStepProps";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { sampleDays } from "@/utils/sampleDays";
import { skySwatchFor } from "@/utils/sky";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));
jest.mock("expo-blur", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { BlurView: (props: object) => createElement(View, props) };
});
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
  mockReduced = false;
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
    expect(HAPTIC[HAPTIC_FEEDBACK.SELECTION]).toHaveBeenCalledTimes(1);
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
    expect(HAPTIC[HAPTIC_FEEDBACK.SELECTION]).toHaveBeenCalledTimes(1);
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

    expect(HAPTIC[HAPTIC_FEEDBACK.SELECTION]).not.toHaveBeenCalled();
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
    expect(HAPTIC[HAPTIC_FEEDBACK.SELECTION]).toHaveBeenCalledTimes(1);
  });

  describe("a day run", () => {
    const PREVIEW = DAY_RUN[DAY_RUN_KIND.PREVIEW];
    const PHASES = Object.values(PHASE);
    const playDay = () => screen.getByTestId(PLAY_DAY_PART.BUTTON);
    const player = () => screen.queryByTestId(DAY_RUN_PLAYER_PART.FRAME);
    const tap = (element: ReturnType<typeof screen.getByTestId>) =>
      userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(element);
    const press = (testID: string) => tap(screen.getByTestId(testID));
    const chooseLook = (mode: AppMode) => tap(screen.getByRole("radio", { name: rowName(mode) }));
    /** Lets a mode's native pin settle, as the phone would report it. */
    const settleLook = () => act(() => jest.advanceTimersByTime(PIN_REPORT_LIMIT_MS));
    const focusSpy = () =>
      jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    /** A view as reader focus receives it, known by its testID. */
    const viewWith = (testID: string) =>
      expect.objectContaining({ props: expect.objectContaining({ testID }) });

    /** Draws the player while a run is on, as the onboarding frame does. */
    const Player = () => {
      const run = useDayRun();
      return run && run.status !== DAY_RUN_STATUS.IDLE ? <DayRunPlayer /> : null;
    };
    const Frame = ({ children }: { children: ReactNode }) => (
      <ThemeTransitionContext value={mockTransition}>
        <PhaseContext value={PHASE.ASR}>{children}</PhaseContext>
      </ThemeTransitionContext>
    );
    /** The step inside the flow's run, with the player below it. */
    const renderRun = ({ isRTL = false } = {}) =>
      renderWithTheme(
        <Frame>
          <DaySimulator kind={DAY_RUN_KIND.PREVIEW}>
            <SkyBackground>
              <AppearanceStep {...stepProps()} />
              <Player />
            </SkyBackground>
          </DaySimulator>
        </Frame>,
        { isRTL }
      );
    /** The step under a stand-in run, its methods mocks. */
    const renderUnder = async (overrides: Partial<DayRun>) => {
      const run: DayRun = {
        kind: DAY_RUN_KIND.PREVIEW,
        status: DAY_RUN_STATUS.IDLE,
        phase: undefined,
        progress: 0,
        available: true,
        start: jest.fn(),
        replay: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        jumpTo: jest.fn(),
        done: jest.fn(),
        close: jest.fn(),
        ...overrides,
      };
      await renderWithTheme(
        <Frame>
          <SkyBackground>
            <DayRunContext value={run}>
              <AppearanceStep {...stepProps()} />
            </DayRunContext>
          </SkyBackground>
        </Frame>
      );
      return run;
    };

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("the Appearance step offers to play a day", async () => {
      await renderRun();

      const button = screen.getByRole("button", { name: t("onboarding.appearance.playDay") });
      expect(button).toBe(playDay());
      expect(button).toBeEnabled();
      expect(button.props.accessibilityHint).toBe(t("a11y.onboarding.playDayHint"));
      expect(within(button).getByText(t("onboarding.appearance.playDay"))).toBeTruthy();
      // Adaptive's sky leads the button, one painted band per part of its day.
      const swatch = within(button).getByTestId(SKY_SWATCH_ID, hidden);
      expect(within(swatch).getAllByTestId(SKY_PART.PREVIEW, hidden)).toHaveLength(
        skySwatchFor(AppMode.ADAPTIVE).length
      );
      expect(controlProblems()).toEqual([]);
    });

    it("draws no button outside a run's simulator", async () => {
      await renderAppearance();

      expect(screen.queryByTestId(PLAY_DAY_PART.BUTTON)).toBeNull();
    });

    it("the button starts a run", async () => {
      await renderRun();
      expect(player()).toBeNull();

      await press(PLAY_DAY_PART.BUTTON);

      expect(player()).toBeOnTheScreen();
      expect(playDay()).toBeDisabled();
    });

    it("the button starts the run as its starter", async () => {
      const run = await renderUnder({});

      await press(PLAY_DAY_PART.BUTTON);

      expect(run.start).toHaveBeenCalledTimes(1);
      expect(run.start).toHaveBeenCalledWith(viewWith(PLAY_DAY_PART.BUTTON));
    });

    // The run closes back to the button, so it stays while the run is on.
    it.each([true, false])(
      "holds the button while a run is on (a whole day: %s)",
      async (available) => {
        const run = await renderUnder({ status: DAY_RUN_STATUS.PLAYING, available });

        expect(playDay()).toBeDisabled();
        await press(PLAY_DAY_PART.BUTTON);
        expect(run.start).not.toHaveBeenCalled();
      }
    );

    // A button that cannot play reads as broken, so there is none to see.
    it("draws no button, and no room for one, while the run has no whole day", async () => {
      await renderUnder({ available: false });

      expect(screen.queryByTestId(PLAY_DAY_PART.BUTTON, hidden)).toBeNull();
      const group = screen.getByTestId(ONBOARDING_PART.APPEARANCE_PREVIEW, hidden);
      expect(group.children).toHaveLength(1);
      expect(within(group).getByTestId(TODAY_STYLE_PREVIEW_PART.ROOT, hidden)).toBeTruthy();
    });

    it("choosing a look during a run ends the run first", async () => {
      const run = await renderUnder({ status: DAY_RUN_STATUS.PLAYING });

      await chooseLook(AppMode.DARK);
      await settleLook();

      expect(run.done).toHaveBeenCalledTimes(1);
      expect(run.close).not.toHaveBeenCalled();
      expect(mockTransition).toHaveBeenCalledTimes(1);
      const [doneAt] = jest.mocked(run.done).mock.invocationCallOrder;
      expect(doneAt).toBeLessThan(mockTransition.mock.invocationCallOrder[0]);
      expect(useAppStore.getState().mode).toBe(AppMode.DARK);
    });

    // The chosen row stays on screen, so reader focus stays on it.
    it("a look chosen during a run applies with the run ended, focus left on it", async () => {
      const focus = focusSpy();
      await renderRun();
      await press(PLAY_DAY_PART.BUTTON);
      focus.mockClear();

      await chooseLook(AppMode.DARK);
      await settleLook();

      expect(player()).toBeNull();
      expect(playDay()).toBeEnabled();
      expect(useAppStore.getState().mode).toBe(AppMode.DARK);
      expect(focus).not.toHaveBeenCalled();
    });

    it.each([
      ["Done", DAY_RUN_PLAYER_PART.DONE],
      ["Use Adaptive", DAY_RUN_PLAYER_PART.USE_ADAPTIVE],
    ])("gives reader focus back to the button when %s closes the player", async (_case, part) => {
      const focus = focusSpy();
      await renderRun();
      await press(PLAY_DAY_PART.BUTTON);
      focus.mockClear();

      await press(part);
      await settleLook();

      expect(player()).toBeNull();
      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus).toHaveBeenCalledWith(viewWith(PLAY_DAY_PART.BUTTON), "focus");
    });

    // Focus lands first; the look is said after it, queued, never over it.
    it("says the new look after Use Adaptive gives focus back to the button", async () => {
      const focus = focusSpy();
      const announce = jest.mocked(AccessibilityInfo.announceForAccessibilityWithOptions);
      await renderRun();
      await press(PLAY_DAY_PART.BUTTON);
      focus.mockClear();
      announce.mockClear();

      await press(DAY_RUN_PLAYER_PART.USE_ADAPTIVE);
      await settleLook();

      expect(focus).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(t("a11y.onboarding.dayPreview.adaptiveChosen"), {
        queue: true,
      });
      expect(focus.mock.invocationCallOrder[0]).toBeLessThan(announce.mock.invocationCallOrder[0]);
    });

    it("says no look when Done closes the player", async () => {
      const announce = jest.mocked(AccessibilityInfo.announceForAccessibilityWithOptions);
      await renderRun();
      await press(PLAY_DAY_PART.BUTTON);
      announce.mockClear();

      await press(DAY_RUN_PLAYER_PART.DONE);
      await settleLook();

      expect(announce).not.toHaveBeenCalled();
    });

    // With Adaptive chosen, the end still waits for Done.
    it("keeps the player open at the end; a replay still closes to the button", async () => {
      mockReduced = true;
      useAppStore.setState({ mode: AppMode.ADAPTIVE });
      const focus = focusSpy();
      await renderRun();
      await press(PLAY_DAY_PART.BUTTON);
      focus.mockClear();

      for (let step = 0; step < PHASES.length; step++) {
        await act(() => jest.advanceTimersByTime(PREVIEW.phaseMs));
      }

      expect(screen.getByTestId(DAY_RUN_PLAYER_PART.TOGGLE)).toHaveAccessibleName(
        t("a11y.onboarding.dayPreview.replay")
      );
      expect(screen.getByTestId(DAY_RUN_PLAYER_PART.DONE)).toBeOnTheScreen();
      expect(playDay()).toBeDisabled();
      expect(focus).not.toHaveBeenCalled();

      // A replayed day closes back to the same button.
      await press(DAY_RUN_PLAYER_PART.TOGGLE);
      expect(screen.getByTestId(DAY_RUN_PLAYER_PART.TOGGLE)).toHaveAccessibleName(
        t("common.pause")
      );
      await press(DAY_RUN_PLAYER_PART.DONE);
      expect(player()).toBeNull();
      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus).toHaveBeenCalledWith(viewWith(PLAY_DAY_PART.BUTTON), "focus");
    });

    it.each([
      [false, undefined],
      [true, [{ scaleX: -1 }]],
    ])("points the play mark along the reading direction (RTL: %s)", async (isRTL, transform) => {
      await renderRun({ isRTL });

      const mark = screen.getByTestId(PLAY_DAY_PART.MARK, hidden);
      expect(StyleSheet.flatten(mark.props.style)?.transform).toEqual(transform);
    });
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
    expect(HAPTIC[HAPTIC_FEEDBACK.SELECTION]).toHaveBeenCalledTimes(1);
  });

  it("preselects the size nearest the phone's large text, with no tick", async () => {
    scaleSpy.mockReturnValue(1.3);
    await renderWithTheme(<TextSizeStep {...stepProps()} />);

    expect(usePreferencesStore.getState().textSize).toBe(nearestTextSize(1.3));
    expect(HAPTIC[HAPTIC_FEEDBACK.SELECTION]).not.toHaveBeenCalled();
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
