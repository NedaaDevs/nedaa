/* eslint-disable @typescript-eslint/no-require-imports */
import { later } from "@/test-helpers/promises";

const mockIsAlarmKitAvailable = jest.fn();

jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  isAlarmKitAvailable: () => mockIsAlarmKitAvailable(),
}));

type TestingLibrary = typeof import("@testing-library/react-native/pure");

const results: boolean[] = [];
const latest = () => results[results.length - 1];
// What the mount itself rendered, before any native answer reached the hook.
const firstRender = () => results[0];

// The hook caches at module scope, so each case gets its own registry; the
// test library loads from it too, or React's hook dispatcher stays unset.
const setup = (platform: "ios" | "android") => {
  jest.resetModules();
  results.length = 0;
  mockIsAlarmKitAvailable.mockReset();
  jest.doMock("react-native", () => ({ Platform: { OS: platform } }));

  // `pure`: the main entry calls afterEach, which jest rejects inside a test.
  const { act, renderHook }: TestingLibrary = require("@testing-library/react-native/pure");
  const { useAlarmSupported } = require("@/hooks/useAlarmSupported");
  const { alarmSupport }: typeof import("@/utils/alarmSupport") = require("@/utils/alarmSupport");

  return {
    alarmSupport,
    render: async () => {
      await renderHook(() => {
        results.push(useAlarmSupported());
      });
    },
    flush: async () => {
      await act(async () => {});
    },
  };
};

describe("useAlarmSupported", () => {
  afterEach(() => jest.dontMock("react-native"));

  it("reports false until AlarmKit answers, then true", async () => {
    const { render, flush } = setup("ios");
    const answer = later<boolean>();
    mockIsAlarmKitAvailable.mockReturnValue(answer.promise);

    await render();
    expect(results).not.toContain(true);

    answer.release(true);
    await flush();
    expect(latest()).toBe(true);
  });

  it("stays false when AlarmKit is missing", async () => {
    const { render, flush } = setup("ios");
    mockIsAlarmKitAvailable.mockResolvedValue(false);

    await render();
    await flush();

    expect(latest()).toBe(false);
  });

  it("treats a native failure as unsupported", async () => {
    const { render, flush } = setup("ios");
    mockIsAlarmKitAvailable.mockRejectedValue(new Error("bridge down"));

    await render();
    await flush();

    expect(latest()).toBe(false);
  });

  it("asks the native module once and serves later mounts from the cache", async () => {
    const { render, flush } = setup("ios");
    mockIsAlarmKitAvailable.mockResolvedValue(true);

    await render();
    await flush();

    results.length = 0;
    await render();

    expect(firstRender()).toBe(true);
    expect(mockIsAlarmKitAvailable).toHaveBeenCalledTimes(1);
  });

  // The onboarding column reads the same source, so the device is asked once.
  it("shares one native answer with alarmSupport()", async () => {
    const { render, alarmSupport } = setup("ios");
    mockIsAlarmKitAvailable.mockResolvedValue(true);

    await expect(alarmSupport()).resolves.toBe(true);
    await render();

    expect(firstRender()).toBe(true);
    await expect(alarmSupport()).resolves.toBe(true);
    expect(mockIsAlarmKitAvailable).toHaveBeenCalledTimes(1);
  });

  it("hands every early reader the one pending answer", async () => {
    const { render, flush, alarmSupport } = setup("ios");
    const answer = later<boolean>();
    mockIsAlarmKitAvailable.mockReturnValue(answer.promise);

    const early = alarmSupport();
    await render();
    answer.release(true);
    await flush();

    await expect(early).resolves.toBe(true);
    expect(latest()).toBe(true);
    expect(mockIsAlarmKitAvailable).toHaveBeenCalledTimes(1);
  });

  it("reports true on Android without a native call", async () => {
    const { render } = setup("android");

    await render();

    expect(firstRender()).toBe(true);
    expect(mockIsAlarmKitAvailable).not.toHaveBeenCalled();
  });
});
