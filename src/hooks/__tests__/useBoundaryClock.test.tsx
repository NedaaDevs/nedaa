import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import renderer, { act } from "react-test-renderer";

import { useBoundaryClock } from "@/hooks/useBoundaryClock";

const MINUTE = 60_000;
const ticks: number[] = [];
const Probe = ({ enabled = true }: { enabled?: boolean }) => {
  ticks.push(useBoundaryClock(MINUTE, enabled).getTime());
  return null;
};
const latest = () => ticks[ticks.length - 1];
const at = (time: string) => new Date(`2026-09-25T${time}.000Z`).getTime();

type Listener = (state: AppStateStatus) => void;
let listeners: Listener[] = [];
const emit = (state: AppStateStatus) => act(() => listeners.forEach((l) => l(state)));

describe("useBoundaryClock", () => {
  beforeEach(() => {
    ticks.length = 0;
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

  it("ticks on each boundary", () => {
    act(() => {
      renderer.create(<Probe />);
    });

    act(() => jest.advanceTimersByTime(MINUTE));
    expect(latest()).toBe(at("10:01:00"));
    act(() => jest.advanceTimersByTime(MINUTE));
    expect(latest()).toBe(at("10:02:00"));
  });

  // Timers stop while the app is away; on return it catches up and re-aligns.
  it("ticks on return from the background, then on the next boundary", async () => {
    act(() => {
      renderer.create(<Probe />);
    });
    await emit("background");
    jest.setSystemTime(at("10:07:40"));
    await emit("active");
    act(() => jest.advanceTimersByTime(0));

    expect(latest()).toBe(at("10:07:40"));
    act(() => jest.advanceTimersByTime(20_000));
    expect(latest()).toBe(at("10:08:00"));
  });

  it("holds its last tick while disabled", () => {
    act(() => {
      renderer.create(<Probe enabled={false} />);
    });

    act(() => jest.advanceTimersByTime(3 * MINUTE));
    expect(latest()).toBe(at("10:00:00"));
  });
});
