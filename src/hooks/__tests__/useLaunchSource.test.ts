import { Linking } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { useLaunchSource } from "@/hooks/useLaunchSource";
import { ALARM_SCREEN_PATH } from "@/constants/Alarm";
import { NATIVE_READ_TIMEOUT_MS } from "@/constants/Onboarding";

const LAUNCH_TAP = { notification: { request: { identifier: "launch" } } };
/** A link in the native alarm module's shape: `scheme://` then the route. */
const SCHEME = "dev.nedaa.app:/";
const ALARM_URL = `${SCHEME}${ALARM_SCREEN_PATH.RING}?alarmId=1`;
const ALARM_COMPLETE_URL = `${SCHEME}${ALARM_SCREEN_PATH.COMPLETE}?alarmId=1`;
const OTHER_URL = `${SCHEME}/settings${ALARM_SCREEN_PATH.RING}`;

let mockLastResponse: unknown = null;
jest.mock("expo-notifications", () => ({
  getLastNotificationResponse: () => mockLastResponse,
}));

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
});
