import { act, renderHook } from "@testing-library/react-native";

import {
  QUIET_ENDING_SECONDS,
  QUIET_PHASE,
  TASK_CLOCK_TICK_MS,
  WAY_OUT_SOUNDING_SECONDS,
} from "@/constants/WakeTaskShell";
import { useTaskClock } from "@/hooks/useTaskClock";
import { quietPhase, type TaskClock } from "@/utils/taskClock";

const QUIET_MS = 30_000;
const SECOND = 1000;
const ENDING_MS = QUIET_ENDING_SECONDS * SECOND;

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

const setUp = async (audible = true, resume?: TaskClock) => {
  const callbacks = { onQuietStart: jest.fn(), onQuietEnding: jest.fn(), onQuietEnd: jest.fn() };
  const openedAt = Date.now();
  const view = await renderHook(
    (props: { audible: boolean }) =>
      useTaskClock({
        openedAt,
        resume,
        quietMs: QUIET_MS,
        audible: props.audible,
        stepped: false,
        ...callbacks,
      }),
    { initialProps: { audible } }
  );
  return { ...view, ...callbacks };
};

describe("useTaskClock", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("pauses the sound as the task opens", async () => {
    const { result, onQuietStart, onQuietEnd } = await setUp();

    expect(onQuietStart).toHaveBeenCalledTimes(1);
    expect(onQuietEnd).not.toHaveBeenCalled();
    expect(result.current.phase).toBe(QUIET_PHASE.PAUSED);
    expect(result.current.secondsLeft).toBe(QUIET_MS / SECOND);
  });

  it("warns once before the sound returns, then returns it once", async () => {
    const { result, onQuietEnding, onQuietEnd } = await setUp();

    await advance(QUIET_MS - ENDING_MS - TASK_CLOCK_TICK_MS);
    expect(onQuietEnding).not.toHaveBeenCalled();

    await advance(2 * TASK_CLOCK_TICK_MS);
    expect(result.current.phase).toBe(QUIET_PHASE.ENDING);
    await advance(SECOND);
    expect(onQuietEnding).toHaveBeenCalledTimes(1);
    expect(onQuietEnd).not.toHaveBeenCalled();

    await advance(ENDING_MS);
    expect(result.current.phase).toBe(QUIET_PHASE.SOUNDING);
    await advance(10 * SECOND);
    expect(onQuietEnd).toHaveBeenCalledTimes(1);
  });

  it("pauses the sound again when quiet restarts after it returned", async () => {
    const { result, onQuietStart } = await setUp();
    await advance(QUIET_MS + SECOND);

    await act(() => result.current.restartQuiet());

    expect(onQuietStart).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe(QUIET_PHASE.PAUSED);
    expect(result.current.secondsLeft).toBe(QUIET_MS / SECOND);
  });

  it("extends a quiet time that is still running without pausing twice", async () => {
    const { result, onQuietStart, onQuietEnd } = await setUp();
    await advance(QUIET_MS - SECOND);

    await act(() => result.current.restartQuiet());
    await advance(QUIET_MS - SECOND);

    expect(onQuietStart).toHaveBeenCalledTimes(1);
    expect(onQuietEnd).not.toHaveBeenCalled();
  });

  it("shows the way out after enough sounding time, not counting quiet", async () => {
    const { result } = await setUp();
    await advance(QUIET_MS + WAY_OUT_SOUNDING_SECONDS * SECOND - SECOND);
    expect(result.current.wayOut).toBe(false);

    await act(() => result.current.restartQuiet());
    await advance(QUIET_MS + SECOND / 2);
    expect(result.current.wayOut).toBe(false);

    await advance(SECOND);
    expect(result.current.wayOut).toBe(true);
  });

  it("counts no sounding time while the alarm cannot be heard", async () => {
    const { result, rerender } = await setUp(false);
    await advance(QUIET_MS + WAY_OUT_SOUNDING_SECONDS * SECOND);
    expect(result.current.wayOut).toBe(false);

    await rerender({ audible: true });
    await advance(WAY_OUT_SOUNDING_SECONDS * SECOND + SECOND);
    expect(result.current.wayOut).toBe(true);
  });

  it("draws no tick while the alarm cannot be heard, then the next one heard", async () => {
    const { result, rerender, onQuietEnd } = await setUp(false);
    const opened = result.current;

    await advance(QUIET_MS + SECOND);
    expect(result.current).toBe(opened);

    await rerender({ audible: true });
    await advance(TASK_CLOCK_TICK_MS);
    expect(result.current.phase).toBe(QUIET_PHASE.SOUNDING);
    // The unheard ticks counted, so the heard one finds quiet already over.
    expect(onQuietEnd).not.toHaveBeenCalled();
  });

  it("makes no sound changes while the alarm cannot be heard", async () => {
    const { onQuietStart, onQuietEnding, onQuietEnd } = await setUp(false);
    await advance(QUIET_MS + SECOND);

    expect(onQuietStart).not.toHaveBeenCalled();
    expect(onQuietEnding).not.toHaveBeenCalled();
    expect(onQuietEnd).not.toHaveBeenCalled();
  });

  it("returns the sound when the task is left during quiet time", async () => {
    const { result, onQuietEnd } = await setUp();
    await advance(10 * SECOND);

    let left: TaskClock | undefined;
    await act(() => {
      left = result.current.leave();
    });

    expect(onQuietEnd).toHaveBeenCalledTimes(1);
    expect(left && quietPhase(left, Date.now())).toBe(QUIET_PHASE.SOUNDING);
  });

  it("leaves a sounding alarm as it is", async () => {
    const { result, onQuietEnd } = await setUp();
    await advance(QUIET_MS + SECOND);

    await act(() => {
      result.current.leave();
    });

    expect(onQuietEnd).toHaveBeenCalledTimes(1);
  });

  it("reopens a left task with no new quiet time, keeping its sounding time", async () => {
    const first = await setUp();
    await advance(QUIET_MS + (WAY_OUT_SOUNDING_SECONDS - 10) * SECOND);
    let left: TaskClock | undefined;
    await act(() => {
      left = first.result.current.leave();
    });
    await first.unmount();
    await advance(5 * 60 * SECOND);

    const { result, onQuietStart } = await setUp(true, left);
    expect(onQuietStart).not.toHaveBeenCalled();
    expect(result.current.phase).toBe(QUIET_PHASE.SOUNDING);
    expect(result.current.wayOut).toBe(false);

    await advance(10 * SECOND + SECOND);
    expect(result.current.wayOut).toBe(true);
  });

  it("stops reading the time once unmounted", async () => {
    const { unmount, onQuietEnd } = await setUp();
    await unmount();
    await advance(2 * QUIET_MS);

    expect(onQuietEnd).not.toHaveBeenCalled();
  });
});
