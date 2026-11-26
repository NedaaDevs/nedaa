import { act, renderHook } from "@testing-library/react-native";

import { ALARM_SCREEN_PATH } from "@/constants/Alarm";
import { ONBOARDING_PATH } from "@/constants/Onboarding";
import { UPGRADE_PATH_STATE } from "@/constants/UpgradePath";
import { useOnboardingPath } from "@/hooks/useOnboardingPath";
import { useAppStore } from "@/stores/app";

const HOME = "/";
let mockPathname = HOME;
jest.mock("expo-router", () => ({ usePathname: () => mockPathname }));

const TAP_ID = "tap";
const TAP = { notification: { request: { identifier: TAP_ID } } };
let mockTapListener: ((response: unknown) => void) | null = null;
let mockLastResponse: unknown = null;
const mockRemove = jest.fn();
jest.mock("expo-notifications", () => ({
  getLastNotificationResponse: () => mockLastResponse,
  addNotificationResponseReceivedListener: (listener: (response: unknown) => void) => {
    mockTapListener = listener;
    return { remove: mockRemove };
  },
}));
const tap = () => act(() => mockTapListener?.(TAP));

const mount = () =>
  renderHook((props: { alert: boolean }) => useOnboardingPath(props.alert), {
    initialProps: { alert: false },
  });

beforeEach(() => {
  mockPathname = HOME;
  mockTapListener = null;
  mockLastResponse = null;
  mockRemove.mockClear();
  useAppStore.setState({ isFirstRun: false, upgradePath: UPGRADE_PATH_STATE.PENDING });
});

describe("useOnboardingPath", () => {
  it("opens the upgrade path on a normal launch", async () => {
    const { result } = await mount();

    expect(result.current.path).toBe(ONBOARDING_PATH.UPGRADE);
  });

  it("the alarm screen hides the path for the launch", async () => {
    const { result, rerender } = await mount();

    mockPathname = ALARM_SCREEN_PATH.RING;
    await rerender({ alert: false });
    expect(result.current.path).toBeNull();

    mockPathname = HOME;
    await rerender({ alert: false });
    expect(result.current.path).toBeNull();
  });

  it("the alarm-complete screen hides the path too", async () => {
    const { result, rerender } = await mount();

    mockPathname = ALARM_SCREEN_PATH.COMPLETE;
    await rerender({ alert: false });

    expect(result.current.path).toBeNull();
  });

  it("opens the path again on the next normal launch", async () => {
    mockPathname = ALARM_SCREEN_PATH.RING;
    const alarmLaunch = await mount();
    expect(alarmLaunch.result.current.path).toBeNull();
    await alarmLaunch.unmount();

    mockPathname = HOME;
    const { result } = await mount();

    expect(result.current.path).toBe(ONBOARDING_PATH.UPGRADE);
  });

  it("a tap kept from before the hook mounts closes the path", async () => {
    mockLastResponse = TAP;
    const { result } = await mount();

    expect(result.current.path).toBeNull();
  });

  it("follows the store when the path closes", async () => {
    const { result } = await mount();

    await act(() => useAppStore.getState().setUpgradePath(UPGRADE_PATH_STATE.LATER));

    expect(result.current.path).toBeNull();
  });

  it("a tapped notification closes the path for the launch", async () => {
    const { result, rerender } = await mount();

    await tap();
    expect(result.current.path).toBeNull();

    await rerender({ alert: false });
    expect(result.current.path).toBeNull();
  });

  it("a tapped notification leaves a first run in place", async () => {
    useAppStore.setState({ isFirstRun: true });
    const { result } = await mount();

    await tap();

    expect(result.current.path).toBe(ONBOARDING_PATH.FIRST_RUN);
  });

  // The Today card reads the same latch, so it never offers a path that waits.
  it("latches an alert for the launch: a link, an alarm screen or a tap", async () => {
    const normal = await mount();
    expect(normal.result.current.alertLaunch).toBe(false);
    await normal.rerender({ alert: true });
    expect(normal.result.current.alertLaunch).toBe(true);
    await normal.unmount();

    mockPathname = ALARM_SCREEN_PATH.RING;
    const alarm = await mount();
    mockPathname = HOME;
    await alarm.rerender({ alert: false });
    expect(alarm.result.current.alertLaunch).toBe(true);
    await alarm.unmount();

    const tapped = await mount();
    await tap();
    expect(tapped.result.current.alertLaunch).toBe(true);
  });

  it("stops listening for taps when it unmounts", async () => {
    const { unmount } = await mount();

    await unmount();

    expect(mockRemove).toHaveBeenCalled();
  });
});
