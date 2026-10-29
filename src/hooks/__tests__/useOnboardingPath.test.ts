import { act, renderHook } from "@testing-library/react-native";

import { ALARM_SCREEN_PATH } from "@/constants/Alarm";
import { ONBOARDING_PATH } from "@/constants/Onboarding";
import { UPGRADE_PATH_STATE } from "@/constants/UpgradePath";
import { useOnboardingPath } from "@/hooks/useOnboardingPath";
import { useAppStore } from "@/stores/app";

const HOME = "/";
let mockPathname = HOME;
jest.mock("expo-router", () => ({ usePathname: () => mockPathname }));

const mount = () =>
  renderHook((props: { alert: boolean }) => useOnboardingPath(props.alert), {
    initialProps: { alert: false },
  });

beforeEach(() => {
  mockPathname = HOME;
  useAppStore.setState({ isFirstRun: false, upgradePath: UPGRADE_PATH_STATE.PENDING });
});

describe("useOnboardingPath", () => {
  it("opens the upgrade path on a normal launch", async () => {
    const { result } = await mount();

    expect(result.current).toBe(ONBOARDING_PATH.UPGRADE);
  });

  it("the alarm screen hides the path for the launch", async () => {
    const { result, rerender } = await mount();

    mockPathname = ALARM_SCREEN_PATH.RING;
    await rerender({ alert: false });
    expect(result.current).toBeNull();

    mockPathname = HOME;
    await rerender({ alert: false });
    expect(result.current).toBeNull();
  });

  it("the alarm-complete screen hides the path too", async () => {
    const { result, rerender } = await mount();

    mockPathname = ALARM_SCREEN_PATH.COMPLETE;
    await rerender({ alert: false });

    expect(result.current).toBeNull();
  });

  it("opens the path again on the next normal launch", async () => {
    mockPathname = ALARM_SCREEN_PATH.RING;
    const alarmLaunch = await mount();
    expect(alarmLaunch.result.current).toBeNull();
    await alarmLaunch.unmount();

    mockPathname = HOME;
    const { result } = await mount();

    expect(result.current).toBe(ONBOARDING_PATH.UPGRADE);
  });

  it("follows the store when the path closes", async () => {
    const { result } = await mount();

    await act(() => useAppStore.getState().setUpgradePath(UPGRADE_PATH_STATE.LATER));

    expect(result.current).toBeNull();
  });
});
