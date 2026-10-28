import type { ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet } from "react-native";
import { getTokenValue } from "tamagui";
import {
  act,
  fireEvent,
  renderHook,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native";

import { DAY_RUN_PLAYER_PART, DayRunPlayer } from "@/components/onboarding/flow/DayRunPlayer";
import { DAY_RUN_TRACK_PART } from "@/components/onboarding/flow/DayRunTrack";
import { DaySimulator } from "@/components/today/DaySimulator";
import { digitsOf } from "@/components/ui/digit-reserve";
import { ThemeTransitionContext } from "@/components/ui/theme-transition/context";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { PIN_REPORT_LIMIT_MS } from "@/constants/Appearance";
import { DAY_RUN, DAY_RUN_CLOCK_SAMPLES, DAY_RUN_KIND, DAY_RUN_STATUS } from "@/constants/DayRun";
import { PHASE, type Phase } from "@/constants/Phase";
import { useDayRun } from "@/contexts/DayRunContext";
import { useDrawnMode } from "@/contexts/DrawnModeContext";
import { AppDirection, AppLocale, AppMode, PlatformType } from "@/enums/app";
import { useShownDay } from "@/hooks/useShownDay";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { controlProblems } from "@/test-helpers/controls";
import { ThemeProvider } from "@/test-helpers/theme";
import { appearancePreview, PHASE_NAME } from "@/utils/appearancePreview";
import { formatPrayerTime } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { spokenClockTime } from "@/utils/spokenClockTime";

jest.mock("expo-blur", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { BlurView: (props: object) => createElement(View, props) };
});
let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const t = i18n.t.bind(i18n);
const PHASES = Object.values(PHASE);
const PREVIEW = DAY_RUN[DAY_RUN_KIND.PREVIEW];
const NOON = new Date(2026, 9, 24, 12, 30);
const hidden = { includeHiddenElements: true };
const mockTransition = jest.fn(async (fn: () => void | Promise<void>) => {
  await fn();
});
const realSetMode = useAppStore.getState().setMode;
const originalOS = Platform.OS;
const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });

/** Draws the player while a run is on, as the onboarding frame does. */
const Player = () => {
  const run = useDayRun();
  return run && run.status !== DAY_RUN_STATUS.IDLE ? <DayRunPlayer /> : null;
};

/** What the parts inside the run read. */
const useRunView = () => ({ run: useDayRun(), drawn: useDrawnMode(), shown: useShownDay() });

const renderPlayer = ({ isRTL = false } = {}) =>
  renderHook(useRunView, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider isRTL={isRTL}>
        <ThemeTransitionContext value={mockTransition}>
          <DaySimulator kind={DAY_RUN_KIND.PREVIEW}>
            {children}
            <Player />
          </DaySimulator>
        </ThemeTransitionContext>
      </ThemeProvider>
    ),
  });

type View = Awaited<ReturnType<typeof renderPlayer>>["result"];

/** Lets `count` run ticks pass, one render apart. */
const tick = async (count = 1) => {
  for (let step = 0; step < count; step++) {
    await act(() => jest.advanceTimersByTime(PREVIEW.tickMs));
  }
};
/** Lets `count` phases pass; Reduce Motion holds each for one timer. */
const phasesPass = async (count: number) => {
  for (let step = 0; step < count; step++) {
    await act(() => jest.advanceTimersByTime(PREVIEW.phaseMs));
  }
};

const start = (result: View) => act(() => result.current.run?.start());
const press = (testID: string) =>
  userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByTestId(testID));
const toggle = () => screen.getByTestId(DAY_RUN_PLAYER_PART.TOGGLE);
const track = () => screen.getByTestId(DAY_RUN_TRACK_PART.TRACK);
const useAdaptive = () =>
  screen.queryByRole("button", { name: t("onboarding.dayPreview.useAdaptive") });
const adjust = (actionName: string) =>
  act(async () => {
    // userEvent has no accessibility actions, so the action is fired.
    fireEvent(track(), "accessibilityAction", { nativeEvent: { actionName } });
  });
/** Each phase name's style, in the track's order. */
const nameStyles = () =>
  screen
    .getAllByTestId(DAY_RUN_TRACK_PART.NAME, hidden)
    .map((name) => StyleSheet.flatten(name.props.style));
/** Plays a Reduce Motion run on through to its end. */
const playToTheEnd = () => phasesPass(PHASES.length);

describe("DayRunPlayer", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: NOON });
    mockReduced = false;
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ locale: AppLocale.EN, mode: AppMode.SYSTEM, setMode: realSetMode });
    usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: true });
    // No stored times: the run plays the sample day.
    usePrayerTimesStore.setState({ todayTimings: null, usingDefaultLocation: false });
    mockTransition.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    setPlatform(originalOS);
    useAppStore.setState({ setMode: realSetMode });
  });

  it("offers Use Adaptive while another look is chosen", async () => {
    mockReduced = true;
    const { result } = await renderPlayer();
    await start(result);
    expect(useAdaptive()).toBeOnTheScreen();

    await act(() => result.current.run?.pause());
    expect(useAdaptive()).toBeOnTheScreen();

    await act(() => result.current.run?.resume());
    await playToTheEnd();
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.ENDED);
    expect(useAdaptive()).toBeOnTheScreen();
  });

  it("offers no Use Adaptive while Adaptive is chosen", async () => {
    useAppStore.setState({ mode: AppMode.ADAPTIVE });
    const { result } = await renderPlayer();
    await start(result);

    expect(screen.getByTestId(DAY_RUN_PLAYER_PART.FRAME)).toBeOnTheScreen();
    expect(useAdaptive()).toBeNull();
  });

  it("Use Adaptive ends the run and writes Adaptive once", async () => {
    const setMode = jest.fn(realSetMode);
    useAppStore.setState({ setMode });
    const { result } = await renderPlayer();
    await start(result);
    await tick(3);

    await press(DAY_RUN_PLAYER_PART.USE_ADAPTIVE);
    await act(() => jest.advanceTimersByTime(PIN_REPORT_LIMIT_MS));

    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.IDLE);
    expect(setMode).toHaveBeenCalledTimes(1);
    expect(setMode).toHaveBeenCalledWith(AppMode.ADAPTIVE);
    expect(mockTransition).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().mode).toBe(AppMode.ADAPTIVE);
  });

  it("Done restores the chosen look", async () => {
    useAppStore.setState({ mode: AppMode.LIGHT });
    const { result } = await renderPlayer();
    await start(result);
    expect(result.current.drawn).toBe(AppMode.ADAPTIVE);

    const done = screen.getByRole("button", { name: t("onboarding.dayPreview.done") });
    expect(done.props.accessibilityHint).toBe(t("a11y.onboarding.dayPreview.doneHint"));
    await press(DAY_RUN_PLAYER_PART.DONE);

    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.IDLE);
    expect(result.current.drawn).toBe(AppMode.LIGHT);
    expect(useAppStore.getState().mode).toBe(AppMode.LIGHT);
    expect(screen.queryByTestId(DAY_RUN_PLAYER_PART.FRAME)).toBeNull();
  });

  // Reduce Motion starts the run at Fajr, playing.
  it("the track jumps a phase and pauses", async () => {
    mockReduced = true;
    const { result } = await renderPlayer();
    await start(result);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PLAYING);
    expect(result.current.run?.phase).toBe(PHASE.DAWN);

    await adjust(A11Y_ACTION.INCREMENT);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PAUSED);
    expect(result.current.run?.phase).toBe(PHASE.DAY);

    await adjust(A11Y_ACTION.DECREMENT);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PAUSED);
    expect(result.current.run?.phase).toBe(PHASE.DAWN);
    await phasesPass(1);
    expect(result.current.run?.phase).toBe(PHASE.DAWN);
  });

  it("a tap on a phase jumps there and pauses", async () => {
    const { result } = await renderPlayer();
    await start(result);

    const segments = screen.getAllByTestId(DAY_RUN_TRACK_PART.SEGMENT, hidden);
    await act(async () => fireEvent.press(segments[PHASES.indexOf(PHASE.MAGHRIB)]));

    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PAUSED);
    expect(result.current.run?.phase).toBe(PHASE.MAGHRIB);
  });

  it("speaks the phase and the time as the track's value", async () => {
    const { result } = await renderPlayer();
    await start(result);
    await act(() => result.current.run?.jumpTo(PHASE.ASR));

    const { now, day } = result.current.shown;
    const spoken = spokenClockTime(
      now,
      day?.timezone ?? "",
      { locale: AppLocale.EN, use24HourTime: false, western: true },
      t
    );
    expect(track()).toHaveAccessibilityValue({
      min: 0,
      max: PHASES.length - 1,
      now: PHASES.indexOf(PHASE.ASR),
      text: t("a11y.join", { first: t(PHASE_NAME[PHASE.ASR]), second: spoken }),
    });
  });

  // Equal time per phase: each phase's start sits at its fifth of the track.
  it.each([PHASE.DAWN, PHASE.ASR, PHASE.NIGHT])("puts the playhead at %s's start", async (to) => {
    const { result } = await renderPlayer();
    await start(result);
    await act(() => result.current.run?.jumpTo(to));

    const head = screen.getByTestId(DAY_RUN_TRACK_PART.PLAYHEAD, hidden);
    expect(StyleSheet.flatten(head.props.style).start).toBe(
      `${(PHASES.indexOf(to) / PHASES.length) * 100}%`
    );
  });

  it("toggle swaps its label between pause and play", async () => {
    const { result } = await renderPlayer();
    await start(result);
    expect(toggle()).toHaveAccessibleName(t("common.pause"));
    expect(toggle().props.accessibilityHint).toBe(t("a11y.onboarding.dayPreview.pauseHint"));

    await press(DAY_RUN_PLAYER_PART.TOGGLE);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PAUSED);
    expect(toggle()).toHaveAccessibleName(t("common.play"));
    expect(toggle().props.accessibilityHint).toBe(t("a11y.onboarding.dayPreview.playHint"));
    // iOS speaks a selected or checked state in English in every locale.
    expect(toggle().props.accessibilityState).not.toHaveProperty("selected");
    expect(toggle().props.accessibilityState).not.toHaveProperty("checked");

    await press(DAY_RUN_PLAYER_PART.TOGGLE);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PLAYING);
    expect(toggle()).toHaveAccessibleName(t("common.pause"));
  });

  it("offers the day again from its end", async () => {
    mockReduced = true;
    const { result } = await renderPlayer();
    await start(result);
    await playToTheEnd();
    expect(toggle()).toHaveAccessibleName(t("a11y.onboarding.dayPreview.replay"));

    await press(DAY_RUN_PLAYER_PART.TOGGLE);

    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PLAYING);
  });

  it("every player control meets the target size", async () => {
    const { result } = await renderPlayer();
    await start(result);

    expect(useAdaptive()).toBeOnTheScreen();
    expect(controlProblems()).toEqual([]);
    // The track's segments take taps but speak through the track.
    for (const segment of screen.getAllByTestId(DAY_RUN_TRACK_PART.SEGMENT, hidden)) {
      expect(StyleSheet.flatten(segment.props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it.each([
    [false, AppDirection.LTR, undefined],
    [true, AppDirection.RTL, [{ scaleX: -1 }]],
  ])("the track runs from the reading start (RTL: %s)", async (isRTL, direction, transform) => {
    const { result } = await renderPlayer({ isRTL });
    await start(result);
    await act(() => result.current.run?.pause());

    expect(StyleSheet.flatten(track().props.style).direction).toBe(direction);
    const glyph = screen.getByTestId(DAY_RUN_PLAYER_PART.GLYPH, hidden);
    expect(StyleSheet.flatten(glyph.props.style)?.transform).toEqual(transform);
  });

  it("moves reader focus to its toggle when it appears", async () => {
    const focus = jest
      .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
      .mockImplementation(() => {});
    focus.mockClear();
    const { result } = await renderPlayer();
    expect(focus).not.toHaveBeenCalled();

    await start(result);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ testID: DAY_RUN_PLAYER_PART.TOGGLE }),
      }),
      "focus"
    );
  });

  it("announces a pause and the end, never a phase", async () => {
    mockReduced = true;
    const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
    announce.mockClear();
    const { result } = await renderPlayer();
    await start(result);
    await phasesPass(2);
    expect(result.current.run?.phase).toBe(PHASE.ASR);
    expect(announce).not.toHaveBeenCalled();

    await act(() => result.current.run?.pause());
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith(
      screen.getByTestId(DAY_RUN_PLAYER_PART.COPY).props.accessibilityLabel
    );

    await act(() => result.current.run?.resume());
    await playToTheEnd();
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith(t("a11y.onboarding.dayPreview.ended"));
    // iOS has no live regions; the announcement says it all.
    expect(screen.queryByTestId(DAY_RUN_PLAYER_PART.STATUS, hidden)).toBeNull();
  });

  // One region, mounted throughout; only its words change.
  it("says the pause and the end in one live region on Android", async () => {
    setPlatform(PlatformType.ANDROID);
    mockReduced = true;
    const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
    announce.mockClear();
    const status = () => screen.getByTestId(DAY_RUN_PLAYER_PART.STATUS);
    const copy = () => screen.getByTestId(DAY_RUN_PLAYER_PART.COPY);
    const { result } = await renderPlayer();
    await start(result);
    const region = status();
    expect(region).toHaveProp("accessibilityLiveRegion", "polite");
    expect(region).toHaveProp("importantForAccessibility", "yes");
    expect(region).toHaveProp("accessibilityLabel", "");
    expect(region).toHaveProp("accessible", false);
    await phasesPass(2);
    expect(status()).toBe(region);
    expect(status()).toHaveProp("accessibilityLabel", "");

    await act(() => result.current.run?.pause());
    expect(status()).toBe(region);
    expect(status()).toHaveProp("accessibilityLabel", copy().props.accessibilityLabel);
    expect(status()).toHaveProp("accessible", true);
    expect(copy().props.accessibilityLiveRegion).toBeUndefined();

    await act(() => result.current.run?.resume());
    expect(status()).toBe(region);
    expect(status()).toHaveProp("accessibilityLabel", "");

    await playToTheEnd();
    expect(status()).toBe(region);
    expect(status()).toHaveProp("accessibilityLabel", t("a11y.onboarding.dayPreview.ended"));
    expect(copy().props.accessibilityLiveRegion).toBeUndefined();
    expect(announce).not.toHaveBeenCalled();
  });

  // A native view keeps its last role and actions on null, so each is sent.
  it.each([PlatformType.ANDROID, PlatformType.IOS])(
    "offers no adjusting once the run has ended (%s)",
    async (os) => {
      setPlatform(os);
      mockReduced = true;
      const { result } = await renderPlayer();
      await start(result);
      expect(track()).toHaveProp("accessibilityRole", "adjustable");
      expect(track()).toHaveAccessibleName(t("a11y.onboarding.dayPreview.track"));
      expect(track().props.accessibilityActions).toEqual(
        os === PlatformType.ANDROID
          ? expect.arrayContaining([expect.objectContaining({ name: A11Y_ACTION.INCREMENT })])
          : []
      );

      await playToTheEnd();

      expect(track()).toHaveProp("accessibilityRole", "text");
      expect(track().props.accessibilityActions).toEqual([]);
      expect(track()).toHaveAccessibleName(t("a11y.onboarding.dayPreview.track"));
      expect(track().props.accessibilityValue).toEqual({
        text: t(`settings.themes.${AppMode.ADAPTIVE}.title`),
      });
    }
  );

  // The cell holds every copy unseen, so a longer note never moves the toggle.
  it("keeps the copy's height with every copy the run can show", async () => {
    const { result } = await renderPlayer();
    await start(result);

    const sizers = screen.getAllByTestId(DAY_RUN_PLAYER_PART.COPY_SIZER, hidden);
    expect(screen.queryAllByTestId(DAY_RUN_PLAYER_PART.COPY_SIZER)).toHaveLength(0);
    const texts = sizers.map((sizer) =>
      within(sizer)
        .getAllByText(/./, hidden)
        .map((text) => text.props.children)
        .join(" | ")
    );
    expect(texts).toHaveLength(PHASES.length + 1);
    for (const phase of PHASES) {
      const { kicker, note } = appearancePreview(t, AppMode.ADAPTIVE, null, phase);
      expect(texts).toContainEqual(expect.stringContaining(kicker));
      expect(texts).toContainEqual(expect.stringContaining(note));
    }
    expect(texts).toContainEqual(
      expect.stringContaining(t(`settings.themes.${AppMode.ADAPTIVE}.description`))
    );
    const layer = screen.getByTestId(DAY_RUN_PLAYER_PART.COPY_SIZERS, hidden);
    expect(layer).toHaveProp("accessibilityElementsHidden", true);
    expect(layer).toHaveProp("importantForAccessibility", "no-hide-descendants");
    expect(layer).toHaveProp("pointerEvents", "none");
    // Side by side, each the cell's width: the row is as tall as the tallest.
    expect(StyleSheet.flatten(layer.props.style)).toEqual(
      expect.objectContaining({ opacity: 0, flexDirection: "row", overflow: "hidden" })
    );
    for (const sizer of sizers) {
      expect(StyleSheet.flatten(sizer.props.style)).toEqual(
        expect.objectContaining({ width: "100%", flexShrink: 0 })
      );
    }
  });

  // A slot as wide as any clock, so the kicker beside it never reflows.
  it.each([
    [AppLocale.EN, true],
    [AppLocale.AR, false],
  ])("reserves every digit of a morning and an evening clock (%s)", async (locale, western) => {
    await act(() => i18n.changeLanguage(locale));
    useAppStore.setState({ locale });
    usePreferencesStore.setState({ useWesternNumerals: western });
    const { result } = await renderPlayer();
    await start(result);

    const samples = DAY_RUN_CLOCK_SAMPLES.ISOS.map((iso) =>
      localizeDigits(
        formatPrayerTime(new Date(iso), DAY_RUN_CLOCK_SAMPLES.TIMEZONE, {
          locale,
          use24HourTime: false,
        }),
        locale,
        western
      )
    );
    const rows = within(screen.getByTestId(DAY_RUN_PLAYER_PART.COPY)).getAllByTestId(
      DAY_RUN_PLAYER_PART.CLOCK_RESERVE,
      hidden
    );
    const shown = (row: (typeof rows)[number]) =>
      within(row)
        .getAllByText(/./, hidden)
        .filter((text) => text.parent?.props.testID !== DAY_RUN_PLAYER_PART.DIGIT_SIZER)
        .map((text) => text.props.children)
        .join("");
    expect(rows.map(shown)).toEqual(samples);
    expect(new Set(samples).size).toBe(2);

    for (const [index, row] of rows.entries()) {
      const digits = [...samples[index]].filter((character) => digitsOf(character));
      const columns = within(row).getAllByTestId(DAY_RUN_PLAYER_PART.DIGIT_SIZER, hidden);
      expect(columns).toHaveLength(digits.length);
      for (const [at, column] of columns.entries()) {
        expect(
          within(column)
            .getAllByText(/./, hidden)
            .map((text) => text.props.children)
            .join("")
        ).toBe(digitsOf(digits[at]));
      }
    }
  });

  // The sizers reserve the live slot's width, so their kickers wrap as it does.
  it("gives each phase's sizer the live time slot's width", async () => {
    const { result } = await renderPlayer();
    await start(result);
    const slot = within(screen.getByTestId(DAY_RUN_PLAYER_PART.COPY)).getAllByTestId(
      DAY_RUN_PLAYER_PART.CLOCK_RESERVE,
      hidden
    )[0].parent;
    if (!slot) throw new Error("expected the reserve inside the time slot");
    const SLOT_WIDTH = 64;

    await act(async () => {
      fireEvent(slot, "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: SLOT_WIDTH, height: 20 } },
      });
    });

    type Node = ReturnType<typeof screen.getByTestId>;
    const nodesIn = (node: Node): Node[] => [
      node,
      ...node.children.flatMap((child) => (typeof child === "string" ? [] : nodesIn(child))),
    ];
    const spacers = screen
      .getAllByTestId(DAY_RUN_PLAYER_PART.COPY_SIZER, hidden)
      .map(
        (sizer) =>
          nodesIn(sizer).filter(
            (node) => StyleSheet.flatten(node.props.style)?.width === SLOT_WIDTH
          ).length
      );
    expect(spacers).toEqual([...PHASES.map(() => 1), 0]);
  });

  // The live time sits flush at the copy's trailing edge as its width changes.
  it("holds the time at the slot's end", async () => {
    const { result } = await renderPlayer();
    await start(result);

    const { now, day } = result.current.shown;
    const shownTime = localizeDigits(
      formatPrayerTime(now, day?.timezone ?? "", { locale: AppLocale.EN, use24HourTime: false }),
      AppLocale.EN,
      true
    );
    const time = within(screen.getByTestId(DAY_RUN_PLAYER_PART.COPY)).getByText(shownTime);
    expect(StyleSheet.flatten(time.parent?.props.style).alignItems).toBe("flex-end");
  });

  // Small but on screen, and last, so swiping reaches the controls first.
  it("draws the Android region small and last in the card", async () => {
    setPlatform(PlatformType.ANDROID);
    const { result } = await renderPlayer();
    await start(result);

    const status = screen.getByTestId(DAY_RUN_PLAYER_PART.STATUS);
    const side = getTokenValue("$0.5", "size");
    expect(side).toBeGreaterThan(0);
    expect(StyleSheet.flatten(status.props.style)).toEqual(
      expect.objectContaining({ width: side, height: side, position: "absolute" })
    );
    expect(screen.getByTestId(DAY_RUN_PLAYER_PART.FRAME).children.at(-1)).toBe(status);
  });

  // Each name is one word: it shrinks to fit rather than break.
  it("fits each phase name on one line", async () => {
    const { result } = await renderPlayer();
    await start(result);

    for (const name of screen.getAllByTestId(DAY_RUN_TRACK_PART.NAME, hidden)) {
      expect(name).toHaveProp("numberOfLines", 1);
      expect(name).toHaveProp("adjustsFontSizeToFit", true);
      expect(name).toHaveProp("minimumFontScale", 0.75);
    }
  });

  // The prelude is the night before Fajr: the track has not reached its start.
  it("holds the track at its start through the prelude", async () => {
    const { result } = await renderPlayer();
    await start(result);
    expect(result.current.run?.phase).toBe(PHASE.NIGHT);
    expect(track()).toHaveAccessibilityValue({ now: 0 });
    // No phase name is lit: all five are drawn alike.
    expect(new Set(nameStyles().map((style) => JSON.stringify(style))).size).toBe(1);

    await adjust(A11Y_ACTION.DECREMENT);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PLAYING);

    await adjust(A11Y_ACTION.INCREMENT);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PAUSED);
    expect(result.current.run?.phase).toBe(PHASE.DAWN);
    expect(track()).toHaveAccessibilityValue({ now: 0 });
    const [fajr, ...rest] = nameStyles();
    expect(fajr).not.toEqual(rest[0]);
  });

  it.each([[PHASE.DAWN], [PHASE.MAGHRIB]] as [Phase][])(
    "reads the card as one element at %s",
    async (to) => {
      const { result } = await renderPlayer();
      await start(result);
      await act(() => result.current.run?.jumpTo(to));

      const copy = screen.getByTestId(DAY_RUN_PLAYER_PART.COPY);
      expect(copy.props.accessible).toBe(true);
      expect(copy.props.accessibilityLabel).toContain(t(`settings.themes.phases.${to}.note`));
    }
  );
});
