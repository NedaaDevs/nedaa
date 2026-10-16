import { AppState, type AppStateStatus } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { useBoundaryClock } from "@/hooks/useBoundaryClock";

const MINUTE = 60_000;
// The time is read while the hook renders, so a tick must re-render to count.
const renderClock = (enabled = true) =>
  renderHook(() => useBoundaryClock(MINUTE, enabled).getTime());
const at = (time: string) => new Date(`2026-09-25T${time}.000Z`).getTime();

type Listener = (state: AppStateStatus) => void;
let listeners: Listener[] = [];
const emit = (state: AppStateStatus) => act(() => listeners.forEach((l) => l(state)));

describe("useBoundaryClock", () => {
  beforeEach(() => {
    listeners = [];
    jest.useFakeTimers({ now: at("10:00:00") });
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      listeners.push(handler as Listener);
      return { remove: jest.fn() } as never;
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("ticks on each boundary", async () => {
    const { result } = await renderClock();

    await act(() => jest.advanceTimersByTime(MINUTE));
    expect(result.current).toBe(at("10:01:00"));
    await act(() => jest.advanceTimersByTime(MINUTE));
    expect(result.current).toBe(at("10:02:00"));
  });

  // Timers stop while the app is away; on return it catches up and re-aligns.
  it("ticks on return from the background, then on the next boundary", async () => {
    const { result } = await renderClock();
    await emit("background");
    jest.setSystemTime(at("10:07:40"));
    await emit("active");
    await act(() => jest.advanceTimersByTime(0));

    expect(result.current).toBe(at("10:07:40"));
    await act(() => jest.advanceTimersByTime(20_000));
    expect(result.current).toBe(at("10:08:00"));
  });

  it("holds its last tick while disabled", async () => {
    const { result } = await renderClock(false);

    await act(() => jest.advanceTimersByTime(3 * MINUTE));
    expect(result.current).toBe(at("10:00:00"));
  });
});
