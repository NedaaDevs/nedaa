import { Linking, Platform } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { useLaunchSource } from "@/hooks/useLaunchSource";
import { ALARM_SCREEN_PATH, ALARM_SETTINGS_ROUTE, ALARM_TYPE } from "@/constants/Alarm";
import { NATIVE_READ_TIMEOUT_MS } from "@/constants/Onboarding";
import { PlatformType } from "@/enums/app";

const LAUNCH_TAP_ID = "launch-tap";
const LAUNCH_TAP = { notification: { request: { identifier: LAUNCH_TAP_ID } } };
/** The scheme the native alarm module writes into its links. */
const NATIVE_ALARM_SCHEME = "dev.nedaa.app";
const ALARM_ID = "alarm-1";
const link = (path: string) => `${NATIVE_ALARM_SCHEME}:/${path}?alarmId=${ALARM_ID}`;
const ALARM_URL = link(ALARM_SCREEN_PATH.RING);
const ALARM_COMPLETE_URL = link(ALARM_SCREEN_PATH.COMPLETE);
/** A route that names alarms but is not an alarm screen. */
const OTHER_URL = link(`/${ALARM_SETTINGS_ROUTE}`);
/** A row the Android overlay leaves after a snooze. */
const SNOOZED = {
  id: 1,
  originalAlarmId: ALARM_ID,
  snoozeAlarmId: `${ALARM_ID}-snooze`,
  alarmType: ALARM_TYPE.FAJR,
  title: ALARM_TYPE.FAJR,
  snoozeCount: 1,
  snoozeEndTime: 0,
};

let mockLastResponse: unknown = null;
jest.mock("expo-notifications", () => ({
  getLastNotificationResponse: () => mockLastResponse,
}));

const mockSnoozeQueue = jest.fn(async (): Promise<unknown[]> => []);
jest.mock("expo-alarm", () => ({ getSnoozeQueue: () => mockSnoozeQueue() }));

/** A launch URL the test hands over when it chooses. */
const initialUrl = () => {
  let resolve: (url: string | null) => void = () => undefined;
  const pending = new Promise<string | null>((done) => {
    resolve = done;
  });
  jest.spyOn(Linking, "getInitialURL").mockReturnValue(pending);
  return (url: string | null) => act(async () => resolve(url));
};

beforeEach(() => {
  mockLastResponse = null;
  mockSnoozeQueue.mockReset().mockResolvedValue([]);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("useLaunchSource", () => {
  it("is not ready until the launch URL is read", async () => {
    const answer = initialUrl();
    const { result } = await renderHook(() => useLaunchSource());
    expect(result.current.ready).toBe(false);

    await answer(null);

    expect(result.current).toEqual({ ready: true, launchedByAlert: false });
  });

  it("a launch from a tapped notification counts as an alert launch", async () => {
    mockLastResponse = LAUNCH_TAP;
    const answer = initialUrl();
    const { result, rerender } = await renderHook(() => useLaunchSource());
    // useNotificationResponses clears the tap once it handles it.
    mockLastResponse = null;
    await rerender({});

    await answer(null);

    expect(result.current).toEqual({ ready: true, launchedByAlert: true });
  });

  it("an alarm deep link counts as an alert launch", async () => {
    const answer = initialUrl();
    const { result } = await renderHook(() => useLaunchSource());

    await answer(ALARM_URL);

    expect(result.current).toEqual({ ready: true, launchedByAlert: true });
  });

  it("an alarm-complete link counts as an alert launch", async () => {
    const answer = initialUrl();
    const { result } = await renderHook(() => useLaunchSource());

    await answer(ALARM_COMPLETE_URL);

    expect(result.current.launchedByAlert).toBe(true);
  });

  it("another link is a normal launch", async () => {
    const answer = initialUrl();
    const { result } = await renderHook(() => useLaunchSource());

    await answer(OTHER_URL);

    expect(result.current).toEqual({ ready: true, launchedByAlert: false });
  });

  it("a failed URL read is a normal launch", async () => {
    jest.spyOn(Linking, "getInitialURL").mockRejectedValue(new Error("no url"));
    const { result } = await renderHook(() => useLaunchSource());

    await act(async () => undefined);

    expect(result.current).toEqual({ ready: true, launchedByAlert: false });
  });

  it("a URL read with no answer stops holding the first frame", async () => {
    jest.useFakeTimers();
    initialUrl();
    const { result } = await renderHook(() => useLaunchSource());

    await act(() => jest.advanceTimersByTimeAsync(NATIVE_READ_TIMEOUT_MS));

    expect(result.current).toEqual({ ready: true, launchedByAlert: false });
  });

  it("a snooze from the Android alarm overlay counts as an alert launch", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    mockSnoozeQueue.mockResolvedValue([SNOOZED]);
    const answer = initialUrl();
    const { result } = await renderHook(() => useLaunchSource());

    await answer(null);

    expect(result.current).toEqual({ ready: true, launchedByAlert: true });
  });

  it("waits for the snooze queue before it is ready", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    let resolveQueue: (rows: unknown[]) => void = () => undefined;
    mockSnoozeQueue.mockReturnValue(new Promise((done) => (resolveQueue = done)));
    const answer = initialUrl();
    const { result } = await renderHook(() => useLaunchSource());

    await answer(null);
    expect(result.current.ready).toBe(false);

    await act(async () => resolveQueue([SNOOZED]));
    expect(result.current).toEqual({ ready: true, launchedByAlert: true });
  });

  it("an empty snooze queue is a normal launch", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    const answer = initialUrl();
    const { result } = await renderHook(() => useLaunchSource());

    await answer(null);

    expect(result.current).toEqual({ ready: true, launchedByAlert: false });
  });

  it("a failed snooze read is a normal launch", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    mockSnoozeQueue.mockRejectedValue(new Error("no queue"));
    const answer = initialUrl();
    const { result } = await renderHook(() => useLaunchSource());

    await answer(null);

    expect(result.current).toEqual({ ready: true, launchedByAlert: false });
  });

  it("reads no snooze queue on iOS", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.IOS);
    mockSnoozeQueue.mockResolvedValue([SNOOZED]);
    const answer = initialUrl();
    const { result } = await renderHook(() => useLaunchSource());

    await answer(null);

    expect(mockSnoozeQueue).not.toHaveBeenCalled();
    expect(result.current.launchedByAlert).toBe(false);
  });
});
