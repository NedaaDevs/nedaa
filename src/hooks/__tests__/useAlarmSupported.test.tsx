/* eslint-disable @typescript-eslint/no-require-imports */
import { later } from "@/test-helpers/promises";

const mockIsAlarmKitAvailable = jest.fn();

jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  isAlarmKitAvailable: () => mockIsAlarmKitAvailable(),
}));

const results: boolean[] = [];
const latest = () => results[results.length - 1];

// The hook caches its answer at module scope, so every case needs its own module
// registry. React and the renderer come from that same registry: two copies of
// React in one tree would leave the hook dispatcher unset.
const setup = (platform: "ios" | "android") => {
  jest.resetModules();
  results.length = 0;
  mockIsAlarmKitAvailable.mockReset();
  jest.doMock("react-native", () => ({ Platform: { OS: platform } }));

  const React = require("react");
  const renderer = require("react-test-renderer");
  const { useAlarmSupported } = require("@/hooks/useAlarmSupported");
  const { alarmSupport }: typeof import("@/utils/alarmSupport") = require("@/utils/alarmSupport");

  const Probe = () => {
    results.push(useAlarmSupported());
    return null;
  };

  return {
    alarmSupport,
    render: () => {
      renderer.act(() => {
        renderer.create(React.createElement(Probe));
      });
    },
    flush: async () => {
      await renderer.act(async () => {});
    },
  };
};

describe("useAlarmSupported", () => {
  afterEach(() => jest.dontMock("react-native"));

  it("reports false until AlarmKit answers, then true", async () => {
    const { render, flush } = setup("ios");
    mockIsAlarmKitAvailable.mockResolvedValue(true);

    render();
    expect(latest()).toBe(false);

    await flush();
    expect(latest()).toBe(true);
  });

  it("stays false when AlarmKit is missing", async () => {
    const { render, flush } = setup("ios");
    mockIsAlarmKitAvailable.mockResolvedValue(false);

    render();
    await flush();

    expect(latest()).toBe(false);
  });

  it("treats a native failure as unsupported", async () => {
    const { render, flush } = setup("ios");
    mockIsAlarmKitAvailable.mockRejectedValue(new Error("bridge down"));

    render();
    await flush();

    expect(latest()).toBe(false);
  });

  it("asks the native module once and serves later mounts from the cache", async () => {
    const { render, flush } = setup("ios");
    mockIsAlarmKitAvailable.mockResolvedValue(true);

    render();
    await flush();

    results.length = 0;
    render();

    expect(latest()).toBe(true);
    expect(mockIsAlarmKitAvailable).toHaveBeenCalledTimes(1);
  });

  // The onboarding column reads the same source, so the device is asked once.
  it("shares one native answer with alarmSupport()", async () => {
    const { render, alarmSupport } = setup("ios");
    mockIsAlarmKitAvailable.mockResolvedValue(true);

    await expect(alarmSupport()).resolves.toBe(true);
    render();

    expect(latest()).toBe(true);
    await expect(alarmSupport()).resolves.toBe(true);
    expect(mockIsAlarmKitAvailable).toHaveBeenCalledTimes(1);
  });

  it("hands every early reader the one pending answer", async () => {
    const { render, flush, alarmSupport } = setup("ios");
    const answer = later<boolean>();
    mockIsAlarmKitAvailable.mockReturnValue(answer.promise);

    const early = alarmSupport();
    render();
    answer.release(true);
    await flush();

    await expect(early).resolves.toBe(true);
    expect(latest()).toBe(true);
    expect(mockIsAlarmKitAvailable).toHaveBeenCalledTimes(1);
  });

  it("reports true on Android without a native call", () => {
    const { render } = setup("android");

    render();

    expect(latest()).toBe(true);
    expect(mockIsAlarmKitAvailable).not.toHaveBeenCalled();
  });
});
