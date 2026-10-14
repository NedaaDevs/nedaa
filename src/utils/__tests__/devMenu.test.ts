import { registerDevMenuItems } from "expo-dev-menu";

import { DEBUG_COPY } from "@/constants/DebugScreens";
import { useAppStore } from "@/stores/app";
import { AppLogger } from "@/utils/appLogger";
import { registerDevMenu } from "@/utils/devMenu";

jest.mock("expo-dev-menu", () => ({ registerDevMenuItems: jest.fn(() => Promise.resolve()) }));

const devBuild = __DEV__;
/** `__DEV__` is a read-only global in the types; the test build may set it. */
const setDevBuild = (on: boolean) => Reflect.set(globalThis, "__DEV__", on);
const restartOnboarding = useAppStore.getState().restartOnboarding;

afterEach(() => {
  jest.restoreAllMocks();
  setDevBuild(devBuild);
  useAppStore.setState({ restartOnboarding });
  jest.mocked(registerDevMenuItems).mockClear();
});

it("adds Restart onboarding to the dev menu, running the store's restart", () => {
  setDevBuild(true);
  const restart = jest.fn();
  useAppStore.setState({ restartOnboarding: restart });

  registerDevMenu();

  expect(registerDevMenuItems).toHaveBeenCalledTimes(1);
  const items = jest.mocked(registerDevMenuItems).mock.lastCall?.[0] ?? [];
  expect(items.map((item) => item.name)).toEqual([DEBUG_COPY.RESTART_ONBOARDING]);
  items[0]?.callback();
  expect(restart).toHaveBeenCalledTimes(1);
});

it("adds nothing outside a dev build", () => {
  setDevBuild(false);

  registerDevMenu();

  expect(registerDevMenuItems).not.toHaveBeenCalled();
});

it("logs, without throwing, when a dev build has no dev menu", async () => {
  setDevBuild(true);
  const warn = jest.spyOn(AppLogger.create("app"), "w").mockImplementation(() => {});
  jest.mocked(registerDevMenuItems).mockRejectedValueOnce(new Error("no ExpoDevMenu"));

  await expect(registerDevMenu()).resolves.toBeUndefined();

  expect(warn).toHaveBeenCalledWith("DevMenu", expect.stringContaining("no ExpoDevMenu"));
});
