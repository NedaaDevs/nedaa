import { createRef, useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Text, View, type ViewInstance } from "react-native";
import { Theme } from "tamagui";
import { act, renderHook, screen, userEvent } from "@testing-library/react-native";
import { parseISO } from "date-fns";

import { DaySimulator, DaySimulatorButton } from "@/components/today/DaySimulator";
import config from "../../../../tamagui.config";
import { useTheme } from "@/components/ui/theme-color";
import { APP_STATE } from "@/constants/AppState";
import {
  DAY_RUN,
  DAY_RUN_DEBUG_LABEL,
  DAY_RUN_KIND,
  DAY_RUN_MARGIN_MS,
  DAY_RUN_STATUS,
  type DayRunKind,
} from "@/constants/DayRun";
import { PHASE, type Phase } from "@/constants/Phase";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { useDayRun } from "@/contexts/DayRunContext";
import { useDrawnMode } from "@/contexts/DrawnModeContext";
import { PhaseContext, usePhase } from "@/contexts/PhaseContext";
import { AppMode } from "@/enums/app";
import { useAppIsDark } from "@/hooks/useAppIsDark";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useStoredDays } from "@/hooks/useStoredDays";
import { useClockOverride, useTodayClock } from "@/hooks/useTodayClock";
import { useAppStore } from "@/stores/app";
import { useDebugModeStore } from "@/stores/debugMode";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { captureAppState, emitAppState } from "@/test-helpers/appStateMock";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme, ThemeProvider } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { dayRunLengthMs, dayRunPhaseStartMs, dayRunSchedule } from "@/utils/dayRun";
import { ONE_DAY_MS, type StoredDays } from "@/utils/phase";
import { sampleDays } from "@/utils/sampleDays";

const DAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T05:50:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};
// The real store persists through native kv-store calls jest does not load.
jest.mock("@/stores/debugMode", () => {
  const { create } = jest.requireActual("zustand");
  return { useDebugModeStore: create(() => ({ isEnabled: false, toggle: () => {} })) };
});
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: jest.fn(() => false) }));

const NOW = new Date("2026-09-23T02:00:00.000Z");
const MINUTE_MS = 60_000;
const DEBUG = DAY_RUN[DAY_RUN_KIND.DEBUG];
const PREVIEW = DAY_RUN[DAY_RUN_KIND.PREVIEW];
const FAJR_MS = parseISO(DAY.timings[PRAYER_ID.FAJR]).getTime();

/** Where each phase of DAY begins, in the day's order. */
const PHASE_STARTS = [
  DAY.timings[PRAYER_ID.FAJR],
  DAY.otherTimings[OTHER_TIMING.SUNRISE],
  DAY.timings[PRAYER_ID.ASR],
  DAY.timings[PRAYER_ID.MAGHRIB],
  DAY.timings[PRAYER_ID.ISHA],
].map((time) => parseISO(time));

/** The schedule of a run over DAY, from just before its Fajr. */
const SCHEDULE = (() => {
  const schedule = dayRunSchedule({ today: DAY }, new Date(FAJR_MS - 1));
  if (!schedule) throw new Error("expected a schedule");
  return schedule;
})();

/** Ticks until a preview run over DAY reaches `phase`, and until its end. */
const previewTicksTo = (phase: Phase) =>
  dayRunPhaseStartMs(SCHEDULE, DAY_RUN_KIND.PREVIEW, phase) / PREVIEW.tickMs;
const PREVIEW_TICKS = dayRunLengthMs(SCHEDULE, DAY_RUN_KIND.PREVIEW) / PREVIEW.tickMs;

/** Shows the clock Today's parts read. */
const Clock = () => <Text testID="clock">{useTodayClock().toISOString()}</Text>;
const clock = () => screen.getByTestId("clock").props.children as string;

const renderSimulator = () =>
  renderWithTheme(
    <DaySimulator kind={DAY_RUN_KIND.DEBUG}>
      <Clock />
      <DaySimulatorButton />
    </DaySimulator>
  );

/** What the parts inside a run read. */
const useRunView = () => ({
  run: useDayRun(),
  clock: useClockOverride(),
  phase: usePhase(),
  drawn: useDrawnMode(),
  days: useStoredDays(),
  background: useTheme().background.val,
});

/** Renders a run of `kind`, with `sibling` beside the part that reads it. */
const renderRun = (kind: DayRunKind, sibling?: ReactNode) =>
  renderHook(useRunView, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider>
        <DaySimulator kind={kind}>
          {sibling}
          {children}
        </DaySimulator>
      </ThemeProvider>
    ),
  });

/** Lets `count` timer steps of `ms` pass, one render apart. */
const advance = async (ms: number, count = 1) => {
  for (let step = 0; step < count; step++) await act(() => jest.advanceTimersByTime(ms));
};

/** The Fajr of the days' today, in ms. */
const fajrMs = (days: StoredDays) => parseISO(days.today?.timings[PRAYER_ID.FAJR] ?? "").getTime();

const toStore = (days: StoredDays) => ({
  yesterdayTimings: days.yesterday ?? null,
  todayTimings: days.today ?? null,
  tomorrowTimings: days.tomorrow ?? null,
});

describe("DaySimulator", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest.mocked(useReducedMotion).mockReturnValue(false);
    usePrayerTimesStore.setState({ ...toStore({ today: DAY }), usingDefaultLocation: false });
    useAppStore.setState({ mode: AppMode.LIGHT });
    useDebugModeStore.setState({ isEnabled: true });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("offers no simulation outside debug mode", async () => {
    useDebugModeStore.setState({ isEnabled: false });
    await renderSimulator();

    expect(screen.queryByRole("button", { name: DAY_RUN_DEBUG_LABEL })).toBeNull();
  });

  // Only today is stored; the moon's arc still runs a day on to the next Fajr.
  // About 290 ticks, one render each; a full parallel run passes 5 s.
  it("runs the clock from before Fajr to the next Fajr, then back to live", async () => {
    await renderSimulator();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.press(screen.getByRole("button", { name: DAY_RUN_DEBUG_LABEL }));
    const start = new Date(clock()).getTime();
    expect(start).toBe(FAJR_MS - DAY_RUN_MARGIN_MS);

    await advance(DEBUG.tickMs);
    expect(new Date(clock()).getTime() - start).toBe(DEBUG.stepMs);

    const nextFajr = FAJR_MS + ONE_DAY_MS;
    const steps = Math.floor((nextFajr - start) / DEBUG.stepMs);
    await advance(DEBUG.tickMs, steps - 1);
    expect(new Date(clock()).getTime()).toBe(start + steps * DEBUG.stepMs);

    await advance(DEBUG.tickMs);

    expect(new Date(clock()).getMinutes()).toBe(new Date().getMinutes());
    expect(new Date(clock()).getHours()).toBe(new Date().getHours());
  }, 20_000);

  // Past Fajr, with tomorrow stored, the run still plays today's day.
  it("the debug run still moves 5 minutes per tick", async () => {
    const noon = new Date(2026, 8, 23, 12);
    jest.setSystemTime(noon);
    const days = sampleDays(noon);
    usePrayerTimesStore.setState(toStore(days));
    const { result } = await renderRun(DAY_RUN_KIND.DEBUG);

    await act(() => result.current.run?.start());
    const start = fajrMs(days) - DAY_RUN_MARGIN_MS;
    expect(result.current.clock?.getTime()).toBe(start);

    for (let tick = 1; tick <= 3; tick++) {
      await advance(DEBUG.tickMs);
      expect(result.current.clock?.getTime()).toBe(start + tick * DEBUG.stepMs);
    }
    expect(result.current.drawn).toBe(AppMode.LIGHT);
  });

  it("offers no debug run without stored times", async () => {
    usePrayerTimesStore.setState(toStore({}));
    await renderSimulator();

    expect(screen.getByRole("button", { name: DAY_RUN_DEBUG_LABEL })).toBeDisabled();
  });

  // Adaptive draws by the phase; a run must show noon as day, not the live night.
  it("gives Today the simulated phase's brightness and theme", async () => {
    useAppStore.setState({ mode: AppMode.ADAPTIVE });
    const Brightness = () => (
      <Text testID="brightness">{`${useAppIsDark()} ${useTheme().background.val}`}</Text>
    );
    await renderWithTheme(
      <PhaseContext value={PHASE.NIGHT}>
        <Theme name={AppMode.DARK}>
          <DaySimulator kind={DAY_RUN_KIND.DEBUG}>
            <Brightness />
            <DaySimulatorButton />
          </DaySimulator>
        </Theme>
      </PhaseContext>
    );
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(screen.getByRole("button", { name: DAY_RUN_DEBUG_LABEL }));

    await advance(DEBUG.tickMs, (8 * 60 * 60_000) / DEBUG.stepMs);

    expect(screen.getByTestId("brightness")).toHaveTextContent(
      `false ${config.themes.light.background.val}`
    );
  });

  it("does not remount children when a run starts and ends", async () => {
    const mounted = jest.fn();
    const MountCounter = () => {
      useEffect(() => mounted(), []);
      return null;
    };
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW, <MountCounter />);

    await act(() => result.current.run?.start());
    await advance(PREVIEW.tickMs, PREVIEW_TICKS + 1);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.ENDED);
    await act(() => result.current.run?.done());

    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.IDLE);
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  // A part that reads the run renders again when the run changes, not each minute.
  it.each([
    [DAY_RUN_KIND.DEBUG, {}],
    [DAY_RUN_KIND.PREVIEW, { todayTimings: null }],
  ])("keeps a %s run's context through a minute at rest", async (kind, stored) => {
    usePrayerTimesStore.setState(stored);
    const { result } = await renderRun(kind);
    const atRest = result.current.run;

    await act(() => jest.advanceTimersByTime(MINUTE_MS));

    expect(result.current.run).toBe(atRest);
  });

  // With only today stored, no stored night comes before Fajr; the run draws one.
  it("a preview prelude is night with only today stored", async () => {
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW);
    await act(() => result.current.run?.start());

    expect(result.current.phase).toBe(PHASE.NIGHT);
    expect(result.current.run?.phase).toBe(PHASE.NIGHT);
    expect(result.current.background).toBe(config.themes.dark.background.val);

    await advance(PREVIEW.tickMs, previewTicksTo(PHASE.DAWN));
    expect(result.current.run?.phase).toBe(PHASE.DAWN);
  });

  it("a preview run draws Adaptive while the stored mode is Light", async () => {
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW);
    expect(result.current.drawn).toBe(AppMode.LIGHT);

    await act(() => result.current.run?.start());
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PLAYING);
    expect(result.current.drawn).toBe(AppMode.ADAPTIVE);

    await act(() => result.current.run?.pause());
    expect(result.current.drawn).toBe(AppMode.ADAPTIVE);
    expect(useAppStore.getState().mode).toBe(AppMode.LIGHT);
  });

  it("a preview run is dark at Maghrib", async () => {
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW);
    expect(result.current.background).toBe(config.themes.light.background.val);

    await act(() => result.current.run?.start());
    await advance(PREVIEW.tickMs, previewTicksTo(PHASE.MAGHRIB));

    expect(result.current.phase).toBe(PHASE.MAGHRIB);
    expect(result.current.run?.phase).toBe(PHASE.MAGHRIB);
    expect(result.current.background).toBe(config.themes.dark.background.val);
  });

  it("pause holds the clock across ticks", async () => {
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW);
    await act(() => result.current.run?.start());
    await advance(PREVIEW.tickMs, 3);

    await act(() => result.current.run?.pause());
    const held = result.current.clock?.getTime();
    await advance(PREVIEW.tickMs, 20);

    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PAUSED);
    expect(result.current.clock?.getTime()).toBe(held);

    await act(() => result.current.run?.resume());
    await advance(PREVIEW.tickMs);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PLAYING);
    expect(result.current.clock?.getTime()).toBeGreaterThan(held ?? Infinity);
  });

  it("jumpTo pauses at the phase start", async () => {
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW);
    await act(() => result.current.run?.start());
    await advance(PREVIEW.tickMs, 3);

    await act(() => result.current.run?.jumpTo(PHASE.ASR));
    await advance(PREVIEW.tickMs, 5);

    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PAUSED);
    expect(result.current.clock).toEqual(parseISO(DAY.timings[PRAYER_ID.ASR]));
    expect(result.current.phase).toBe(PHASE.ASR);
  });

  it("the end releases the clock and reports ENDED", async () => {
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW);
    await act(() => result.current.run?.start());

    await advance(PREVIEW.tickMs, PREVIEW_TICKS);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PLAYING);
    expect(result.current.clock?.getTime()).toBe(FAJR_MS + ONE_DAY_MS);

    await advance(PREVIEW.tickMs);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.ENDED);
    expect(result.current.clock).toBeNull();
    expect(result.current.drawn).toBe(AppMode.LIGHT);
    expect(result.current.days.today).toBe(DAY);

    await act(() => result.current.run?.done());
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.IDLE);
  });

  // Equal time per phase: each phase's start is its share of the five.
  it("reports how far a run is through its phases", async () => {
    const phases = Object.values(PHASE);
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW);
    expect(result.current.run?.progress).toBe(0);

    await act(() => result.current.run?.start());
    expect(result.current.run?.progress).toBe(0);

    await advance(PREVIEW.tickMs, previewTicksTo(PHASE.ASR));
    expect(result.current.run?.progress).toBeCloseTo(phases.indexOf(PHASE.ASR) / phases.length);

    await advance(PREVIEW.tickMs, PREVIEW_TICKS - previewTicksTo(PHASE.ASR) + 1);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.ENDED);
    expect(result.current.run?.progress).toBe(1);

    await act(() => result.current.run?.done());
    expect(result.current.run?.progress).toBe(0);
  });

  // The run waits where it was; it neither runs on nor jumps ahead on return.
  it("going to the background pauses a run", async () => {
    captureAppState();
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW);
    await act(() => result.current.run?.start());
    await advance(PREVIEW.tickMs, 2);

    await act(() => emitAppState(APP_STATE.BACKGROUND));
    const held = result.current.clock?.getTime();
    await advance(PREVIEW.tickMs, 10);
    await act(() => emitAppState(APP_STATE.ACTIVE));

    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PAUSED);
    expect(result.current.clock?.getTime()).toBe(held);
  });

  it.each([
    ["without stored times", { todayTimings: null }],
    ["for the default place", { usingDefaultLocation: true }],
  ])("a preview run %s uses the sample day", async (_case, stored) => {
    usePrayerTimesStore.setState(stored);
    const sample = sampleDays(NOW);
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW);
    expect(result.current.run?.available).toBe(true);

    await act(() => result.current.run?.start());

    expect(result.current.clock?.getTime()).toBe(fajrMs(sample) - DAY_RUN_MARGIN_MS);
    expect(result.current.days.today).toEqual(sample.today);
  });

  it("close gives reader focus back to the run's starter; done does not", async () => {
    const focus = jest
      .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
      .mockImplementation(() => {});
    // The preset's mock keeps calls from earlier tests.
    focus.mockClear();
    const starter = createRef<ViewInstance>();
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW, <View ref={starter} />);

    await act(() => result.current.run?.start(starter.current));
    await act(() => result.current.run?.done());
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.IDLE);
    expect(focus).not.toHaveBeenCalled();

    await act(() => result.current.run?.start(starter.current));
    await act(() => result.current.run?.close());
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.IDLE);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(starter.current, "focus");
  });

  it("a replay plays the day again for the same starter", async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const focus = jest
      .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
      .mockImplementation(() => {});
    // The preset's mock keeps calls from earlier tests.
    focus.mockClear();
    const starter = createRef<ViewInstance>();
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW, <View ref={starter} />);
    await act(() => result.current.run?.start(starter.current));
    await advance(PREVIEW.phaseMs, PHASE_STARTS.length);
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.ENDED);

    await act(() => result.current.run?.replay());
    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.PLAYING);
    expect(result.current.clock).toEqual(PHASE_STARTS[0]);
    await act(() => result.current.run?.close());

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(starter.current, "focus");
  });

  it("Reduce Motion steps through the five phase starts", async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const { result } = await renderRun(DAY_RUN_KIND.PREVIEW);
    await act(() => result.current.run?.start());

    for (const start of PHASE_STARTS) {
      expect(result.current.clock).toEqual(start);
      await advance(PREVIEW.tickMs);
      expect(result.current.clock).toEqual(start);
      await advance(PREVIEW.phaseMs - PREVIEW.tickMs);
    }

    expect(result.current.run?.status).toBe(DAY_RUN_STATUS.ENDED);
    expect(result.current.clock).toBeNull();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderSimulator();

    expect(controlProblems()).toEqual([]);
  });
});
