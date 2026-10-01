import { useEffect } from "react";
import { Animated, AppState, Easing, Text, type AppStateStatus } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { captureRef, releaseCapture } from "react-native-view-shot";

import { DISSOLVE_PART, ThemeTransitionProvider } from "@/components/ui/theme-transition";
import {
  useThemeDissolving,
  useThemeTransition,
  type WithThemeTransition,
} from "@/components/ui/theme-transition/context";
import { APP_STATE } from "@/constants/AppState";
import { DURATION_MS } from "@/constants/Motion";

const SNAPSHOT_URI = "file:///tmp/snapshot.jpg";
const DISSOLVING_ID = "dissolving";

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(),
  releaseCapture: jest.fn(),
}));

const mockWarn = jest.fn();
jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: (...args: unknown[]) => mockWarn(...args) }),
  },
}));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

let transition: WithThemeTransition;

// The preset mocks `currentState` as a function; replace it outright.
const setAppState = (state: AppStateStatus) =>
  Object.defineProperty(AppState, "currentState", { value: state, configurable: true });

let appStateListeners: ((state: AppStateStatus) => void)[] = [];

/** Sends the app to the background, as the OS reports it. */
const leaveForeground = () =>
  act(async () => {
    setAppState(APP_STATE.BACKGROUND);
    appStateListeners.forEach((listener) => listener(APP_STATE.BACKGROUND));
    await tick();
    await tick();
  });

/** A capture the test settles by hand. */
const heldCapture = () => {
  let finish: (uri: string) => void = () => {};
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  jest.mocked(captureRef).mockReturnValue(pending);
  return { finish: (uri: string) => act(async () => finish(uri)) };
};

/** Hands the test the provider's call and shows whether a dissolve is up. */
const Probe = () => {
  const provided = useThemeTransition();
  useEffect(() => {
    transition = provided;
  }, [provided]);
  return <Text testID={DISSOLVING_ID}>{String(useThemeDissolving())}</Text>;
};

const renderProvider = () =>
  render(
    <ThemeTransitionProvider>
      <Probe />
    </ThemeTransitionProvider>
  );

const snapshot = () =>
  screen.queryByTestId(DISSOLVE_PART.SNAPSHOT, { includeHiddenElements: true });
const dissolving = () => screen.getByTestId(DISSOLVING_ID).props.children;

/** One macrotask, so a resolved capture or a frame can land inside `act`. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Starts a dissolve; wrapped, so awaiting this skips the dissolve. */
const begin = async (fn: () => void | Promise<void>) => {
  let done: Promise<void> = Promise.resolve();
  await act(async () => {
    done = transition(fn);
    await tick();
  });
  // A rejection is asserted later; until then it must not count as unhandled.
  done.catch(() => {});
  return { done };
};

/** Reports the snapshot drawn, then lets the change run inside `act`. */
const load = () =>
  act(async () => {
    fireEvent(snapshot()!, "load");
    await tick();
    await tick();
  });

/** Starts a dissolve and waits for the snapshot to be on screen. */
const startCovered = async (fn: () => void | Promise<void>) => {
  const started = await begin(fn);
  await waitFor(() => expect(snapshot()).not.toBeNull());
  await load();
  return started;
};

/** Waits for the fade to finish and the dissolve to settle. */
const finish = async (done: Promise<void>) => {
  await waitFor(() => expect(snapshot()).toBeNull(), { timeout: DURATION_MS.DISSOLVE * 4 });
  await act(() => done);
};

describe("ThemeTransitionProvider", () => {
  beforeEach(() => {
    mockReduced = false;
    mockWarn.mockClear();
    jest.mocked(captureRef).mockReset().mockResolvedValue(SNAPSHOT_URI);
    jest.mocked(releaseCapture).mockClear();
    setAppState(APP_STATE.ACTIVE);
    appStateListeners = [];
    jest.mocked(AppState.addEventListener).mockImplementation((_, listener) => {
      appStateListeners.push(listener);
      return {
        remove: () => {
          appStateListeners = appStateListeners.filter((other) => other !== listener);
        },
      };
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("covers the screen with a snapshot before it runs the change", async () => {
    await renderProvider();
    const fn = jest.fn();

    const { done } = await begin(fn);
    await waitFor(() => expect(snapshot()).not.toBeNull());

    expect(captureRef).toHaveBeenCalledTimes(1);
    expect(snapshot()).toHaveProp("source", { uri: SNAPSHOT_URI });
    expect(screen.getByTestId(DISSOLVE_PART.OVERLAY, { includeHiddenElements: true })).toHaveProp(
      "pointerEvents",
      "none"
    );
    expect(dissolving()).toBe("true");
    expect(fn).not.toHaveBeenCalled();

    await load();
    await finish(done);
  });

  it("runs the change once the snapshot shows, then fades it out and clears it", async () => {
    await renderProvider();
    const covered: boolean[] = [];
    const fn = jest.fn(() => {
      covered.push(snapshot() !== null);
    });

    const { done } = await startCovered(fn);
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    expect(covered).toEqual([true]);

    await finish(done);
    expect(dissolving()).toBe("false");
    expect(releaseCapture).toHaveBeenCalledWith(SNAPSHOT_URI);
  });

  it("runs the change at once under Reduce Motion, with no snapshot", async () => {
    mockReduced = true;
    await renderProvider();
    const fn = jest.fn();

    await act(() => transition(fn));

    expect(fn).toHaveBeenCalledTimes(1);
    expect(captureRef).not.toHaveBeenCalled();
    expect(snapshot()).toBeNull();
  });

  it("runs the change at once while the app is not in the foreground", async () => {
    setAppState(APP_STATE.BACKGROUND);
    await renderProvider();
    const fn = jest.fn();

    await act(() => transition(fn));

    expect(fn).toHaveBeenCalledTimes(1);
    expect(captureRef).not.toHaveBeenCalled();
  });

  it("runs the change with no overlay when the capture fails, and logs it", async () => {
    jest.mocked(captureRef).mockRejectedValue(new Error("no window"));
    await renderProvider();
    const fn = jest.fn();

    await act(() => transition(fn));

    expect(fn).toHaveBeenCalledTimes(1);
    expect(snapshot()).toBeNull();
    expect(dissolving()).toBe("false");
    expect(mockWarn).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("no window"));
  });

  it("runs the change with no overlay when the snapshot fails to load", async () => {
    await renderProvider();
    const fn = jest.fn();

    const { done } = await begin(fn);
    await waitFor(() => expect(snapshot()).not.toBeNull());
    await act(async () => {
      fireEvent(snapshot()!, "error", { nativeEvent: { error: "decode" } });
      await done;
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(snapshot()).toBeNull();
    expect(releaseCapture).toHaveBeenCalledWith(SNAPSHOT_URI);
  });

  it("clears the overlay and rejects when the change throws", async () => {
    await renderProvider();
    const failure = new Error("boom");

    const { done } = await startCovered(() => {
      throw failure;
    });

    await expect(done).rejects.toBe(failure);
    await waitFor(() => expect(snapshot()).toBeNull());
    expect(dissolving()).toBe("false");
  });

  it("runs a second change under the running dissolve, after the first, with one overlay", async () => {
    await renderProvider();
    const order: string[] = [];

    const first = await begin(() => {
      order.push("first");
    });
    const second = await begin(() => {
      order.push("second");
    });
    await waitFor(() => expect(snapshot()).not.toBeNull());
    expect(
      screen.queryAllByTestId(DISSOLVE_PART.SNAPSHOT, { includeHiddenElements: true })
    ).toHaveLength(1);
    expect(order).toEqual([]);

    await load();
    expect(order).toEqual(["first", "second"]);

    await finish(Promise.all([first.done, second.done]).then(() => {}));
    expect(captureRef).toHaveBeenCalledTimes(1);
  });

  it("starts a new dissolve once the last one has cleared", async () => {
    await renderProvider();

    await finish((await startCovered(jest.fn())).done);
    await finish((await startCovered(jest.fn())).done);

    expect(captureRef).toHaveBeenCalledTimes(2);
  });

  it("fades on an even ease, slow at both ends", async () => {
    const bezier = jest.spyOn(Easing, "bezier");
    await renderProvider();

    await finish((await startCovered(jest.fn())).done);

    expect(bezier).toHaveBeenCalledWith(0.42, 0, 0.58, 1);
  });

  it("waits for an async change before it fades", async () => {
    const timing = jest.spyOn(Animated, "timing");
    await renderProvider();
    let settle = () => {};
    const fn = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        })
    );

    const { done } = await startCovered(fn);
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    await act(tick);
    expect(timing).not.toHaveBeenCalled();
    expect(snapshot()).not.toBeNull();

    await act(async () => settle());
    await finish(done);
    expect(timing).toHaveBeenCalledTimes(1);
  });

  it("covers a call made during the fade with a dissolve of its own", async () => {
    // The first fade ends when the test says so; later ones run for real.
    let endFade: Animated.EndCallback = () => {};
    const timing = jest.spyOn(Animated, "timing").mockReturnValueOnce({
      start: (callback) => {
        endFade = callback ?? endFade;
      },
      stop: jest.fn(),
      reset: jest.fn(),
    });
    await renderProvider();
    const second = jest.fn();

    const first = await startCovered(jest.fn());
    await waitFor(() => expect(timing).toHaveBeenCalledTimes(1));
    const later = await begin(second);
    expect(second).not.toHaveBeenCalled();
    expect(captureRef).toHaveBeenCalledTimes(1);

    await act(async () => endFade({ finished: true }));
    await act(() => first.done);
    await waitFor(() => expect(captureRef).toHaveBeenCalledTimes(2));
    expect(second).not.toHaveBeenCalled();
    await waitFor(() => expect(snapshot()).not.toBeNull());
    await load();
    expect(second).toHaveBeenCalledTimes(1);
    await finish(later.done);
  });

  it("runs the change uncovered when the capture stalls, and logs it", async () => {
    const capture = heldCapture();
    await renderProvider();
    const fn = jest.fn();

    await begin(fn);
    await act(() => new Promise((resolve) => setTimeout(resolve, 1000)));

    expect(fn).toHaveBeenCalledTimes(1);
    expect(snapshot()).toBeNull();
    expect(mockWarn).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("capture"));

    // A capture that lands after the limit is still released.
    await capture.finish(SNAPSHOT_URI);
    expect(releaseCapture).toHaveBeenCalledWith(SNAPSHOT_URI);
  });

  it("runs a call at once while the app is away, even with a dissolve open", async () => {
    await renderProvider();
    const first = jest.fn();
    const second = jest.fn();

    await begin(first);
    await waitFor(() => expect(snapshot()).not.toBeNull());
    setAppState(APP_STATE.BACKGROUND);
    await act(() => transition(second));

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("runs the held change and clears the cover when the app leaves mid-cover", async () => {
    await renderProvider();
    const fn = jest.fn();

    const { done } = await begin(fn);
    await waitFor(() => expect(snapshot()).not.toBeNull());
    await leaveForeground();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(snapshot()).toBeNull();
    await act(() => done);
    expect(releaseCapture).toHaveBeenCalledWith(SNAPSHOT_URI);
    expect(appStateListeners).toHaveLength(0);
  });

  it("stops the fade and clears the cover when the app leaves mid-fade", async () => {
    // A fade that never ends on its own.
    const timing = jest
      .spyOn(Animated, "timing")
      .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
    const stop = jest.spyOn(Animated.Value.prototype, "stopAnimation");
    await renderProvider();

    const { done } = await startCovered(jest.fn());
    await waitFor(() => expect(timing).toHaveBeenCalledTimes(1));
    await leaveForeground();

    expect(stop).toHaveBeenCalled();
    expect(snapshot()).toBeNull();
    await act(() => done);
    expect(releaseCapture).toHaveBeenCalledWith(SNAPSHOT_URI);
    expect(appStateListeners).toHaveLength(0);
  });

  it("runs the change and releases a late capture when the app leaves mid-capture", async () => {
    const capture = heldCapture();
    await renderProvider();
    const fn = jest.fn();

    const { done } = await begin(fn);
    await leaveForeground();
    await act(() => done);
    expect(fn).toHaveBeenCalledTimes(1);

    await capture.finish(SNAPSHOT_URI);
    expect(releaseCapture).toHaveBeenCalledWith(SNAPSHOT_URI);
    expect(snapshot()).toBeNull();
  });
});
