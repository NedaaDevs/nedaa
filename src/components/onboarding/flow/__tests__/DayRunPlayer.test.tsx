import type { ReactNode } from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { act, fireEvent, renderHook, screen, userEvent } from "@testing-library/react-native";

import { DAY_RUN_PLAYER_PART, DayRunPlayer } from "@/components/onboarding/flow/DayRunPlayer";
import { DAY_RUN_TRACK_PART } from "@/components/onboarding/flow/DayRunTrack";
import { DaySimulator } from "@/components/today/DaySimulator";
import { ThemeTransitionContext } from "@/components/ui/theme-transition/context";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { PIN_REPORT_LIMIT_MS } from "@/constants/Appearance";
import { DAY_RUN, DAY_RUN_KIND, DAY_RUN_STATUS } from "@/constants/DayRun";
import { PHASE, type Phase } from "@/constants/Phase";
import { useDayRun } from "@/contexts/DayRunContext";
import { useDrawnMode } from "@/contexts/DrawnModeContext";
import { AppLocale, AppMode } from "@/enums/app";
import { useShownDay } from "@/hooks/useShownDay";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { controlProblems } from "@/test-helpers/controls";
import { ThemeProvider } from "@/test-helpers/theme";
import { PHASE_NAME } from "@/utils/appearancePreview";
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
const PRELUDE_TICKS = PREVIEW.preludeMs / PREVIEW.tickMs;
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
const track = () => screen.getByRole("adjustable", { name: t("a11y.onboarding.dayPreview.track") });
const useAdaptive = () =>
  screen.queryByRole("button", { name: t("onboarding.dayPreview.useAdaptive") });
const adjust = (actionName: string) =>
  act(async () => {
    // userEvent has no accessibility actions, so the action is fired.
    fireEvent(track(), "accessibilityAction", { nativeEvent: { actionName } });
  });
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

  it("the track jumps a phase and pauses", async () => {
    const { result } = await renderPlayer();
    await start(result);
    await tick(PRELUDE_TICKS + 3);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PLAYING);
    expect(result.current.run?.phase).toBe(PHASE.DAWN);

    await adjust(A11Y_ACTION.INCREMENT);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PAUSED);
    expect(result.current.run?.phase).toBe(PHASE.DAY);

    await adjust(A11Y_ACTION.DECREMENT);
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
    [false, "ltr", undefined],
    [true, "rtl", [{ scaleX: -1 }]],
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
    expect(focus).toHaveBeenCalledWith(expect.anything(), "focus");
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
