import { refreshWidgets, POLL_INTERVAL_MS, CONFIRM_TIMEOUT_MS } from "@/services/widgetRefresh";

import type { WidgetRefreshDeps } from "@/services/widgetRefresh";

const makeDeps = (overrides: Partial<WidgetRefreshDeps> = {}): WidgetRefreshDeps => {
  let clock = 0;
  return {
    isReloadAvailable: jest.fn(() => true),
    getPlacedWidgetCount: jest.fn(() => Promise.resolve(1)),
    getLastRenderedAt: jest.fn(() => 1000),
    reload: jest.fn(() => Promise.resolve()),
    now: jest.fn(() => clock),
    sleep: jest.fn((ms: number) => {
      clock += ms;
      return Promise.resolve();
    }),
    ...overrides,
  };
};

describe("refreshWidgets", () => {
  test("reports unavailable without firing a reload", async () => {
    const deps = makeDeps({ isReloadAvailable: jest.fn(() => false) });

    await expect(refreshWidgets(deps)).resolves.toBe("unavailable");
    expect(deps.reload).not.toHaveBeenCalled();
  });

  test("reports none-placed but still fires the reload", async () => {
    const deps = makeDeps({ getPlacedWidgetCount: jest.fn(() => Promise.resolve(0)) });

    await expect(refreshWidgets(deps)).resolves.toBe("none-placed");
    // An under-reported count must not turn the escape hatch into a no-op.
    expect(deps.reload).toHaveBeenCalledTimes(1);
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  test("reports unavailable when the reload throws", async () => {
    const deps = makeDeps({
      reload: jest.fn(() => Promise.reject(new Error("React context not available"))),
    });

    await expect(refreshWidgets(deps)).resolves.toBe("unavailable");
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  test("reports pending when the heartbeat becomes unreadable mid-poll", async () => {
    let reads = 0;
    const deps = makeDeps({
      getLastRenderedAt: jest.fn(() => {
        reads += 1;
        if (reads > 2) throw new Error("container unavailable");
        return 1000;
      }),
    });

    await expect(refreshWidgets(deps)).resolves.toBe("pending");
  });

  test("confirms once the heartbeat advances", async () => {
    let reads = 0;
    const deps = makeDeps({
      // Read 1 is the baseline; the third poll sees the new value.
      getLastRenderedAt: jest.fn(() => {
        reads += 1;
        return reads > 3 ? 2000 : 1000;
      }),
    });

    await expect(refreshWidgets(deps)).resolves.toBe("confirmed");
    expect(deps.sleep).toHaveBeenCalledTimes(3);
  });

  test("confirms when the heartbeat moves backwards", async () => {
    let reads = 0;
    const deps = makeDeps({
      getLastRenderedAt: jest.fn(() => {
        reads += 1;
        return reads === 1 ? 1000 : 500;
      }),
    });

    await expect(refreshWidgets(deps)).resolves.toBe("confirmed");
  });

  test("reports pending only after the full deadline", async () => {
    const deps = makeDeps();

    await expect(refreshWidgets(deps)).resolves.toBe("pending");
    expect(deps.sleep).toHaveBeenCalledTimes(CONFIRM_TIMEOUT_MS / POLL_INTERVAL_MS);
  });

  test("polls anyway when the placed count is unreadable", async () => {
    const deps = makeDeps({
      getPlacedWidgetCount: jest.fn(() => Promise.reject(new Error("unavailable"))),
    });

    await expect(refreshWidgets(deps)).resolves.toBe("pending");
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });
});
