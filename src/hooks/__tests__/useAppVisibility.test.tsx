import React from "react";
import { AppState, AppStateStatus } from "react-native";
import renderer, { act } from "react-test-renderer";

import { useAppVisibility } from "@/hooks/useAppVisibility";

// Captures the hook's output across renders via a probe component.
const results: { isActive: boolean; becameActiveAt: number }[] = [];
const Probe = () => {
  results.push(useAppVisibility());
  return null;
};

type Listener = (state: AppStateStatus) => void;

describe("useAppVisibility", () => {
  let listeners: Listener[];
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    results.length = 0;
    listeners = [];
    let t = 1000;
    nowSpy = jest.spyOn(Date, "now").mockImplementation(() => ++t);
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      const l = handler as Listener;
      listeners.push(l);
      return { remove: () => listeners.splice(listeners.indexOf(l), 1) } as ReturnType<
        typeof AppState.addEventListener
      >;
    });
  });

  afterEach(() => {
    nowSpy.mockRestore();
    (AppState.addEventListener as jest.Mock).mockRestore();
  });

  const latest = () => results[results.length - 1];
  // Deliver to whatever is subscribed right now (the hook may resubscribe between acts).
  const emit = (state: AppStateStatus) => [...listeners].forEach((l) => l(state));

  it("records a foreground return when events arrive in separate batches", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Probe />);
    });
    const initial = latest().becameActiveAt;

    act(() => emit("background"));
    act(() => emit("active"));

    expect(latest().isActive).toBe(true);
    expect(latest().becameActiveAt).toBeGreaterThan(initial);
    act(() => tree.unmount());
  });

  it("records a foreground return when background->active arrive in one batch", () => {
    // React batches both events' state updates into one render pass — the exact
    // shape of a quick system-dialog dismiss or a queued event burst on resume.
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Probe />);
    });
    const initial = latest().becameActiveAt;

    act(() => {
      emit("background");
      emit("active");
    });

    expect(latest().isActive).toBe(true);
    expect(latest().becameActiveAt).toBeGreaterThan(initial);
    act(() => tree.unmount());
  });
});
