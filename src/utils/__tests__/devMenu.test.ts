import { registerDevMenuItems } from "expo-dev-menu";

import { DEBUG_COPY } from "@/constants/DebugScreens";
import { LocationMode } from "@/enums/location";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
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
  const item = items.find(({ name }) => name === DEBUG_COPY.RESTART_ONBOARDING);
  item?.callback();
  expect(restart).toHaveBeenCalledTimes(1);
});

// The launch check needs a real move; QA opens the sheet from here instead.
it("adds Show city change, offering a sample city against the saved one", () => {
  setDevBuild(true);
  useLocationStore.setState((state) => ({
    locationMode: LocationMode.DEVICE,
    pendingCityChange: null,
    showCityChangeModal: false,
    locationDetails: { ...state.locationDetails, address: { city: "Riyadh", country: "SA" } },
  }));

  registerDevMenu();

  const items = jest.mocked(registerDevMenuItems).mock.lastCall?.[0] ?? [];
  expect(items.map(({ name }) => name)).toEqual([
    DEBUG_COPY.RESTART_ONBOARDING,
    DEBUG_COPY.SHOW_CITY_CHANGE,
  ]);
  items[1]?.callback();
  const state = useLocationStore.getState();
  expect(state.showCityChangeModal).toBe(true);
  expect(state.pendingCityChange).toEqual({
    currentCity: "Riyadh",
    newCity: DEBUG_COPY.SAMPLE_NEW_CITY,
  });
});

// The sheet's update reads the device; over a chosen city it would mix the two.
it("offers no city change over a chosen city, as the launch check does", () => {
  setDevBuild(true);
  useLocationStore.setState({
    locationMode: LocationMode.MANUAL,
    pendingCityChange: null,
    showCityChangeModal: false,
  });

  registerDevMenu();

  const items = jest.mocked(registerDevMenuItems).mock.lastCall?.[0] ?? [];
  items.find(({ name }) => name === DEBUG_COPY.SHOW_CITY_CHANGE)?.callback();
  expect(useLocationStore.getState().showCityChangeModal).toBe(false);
  expect(useLocationStore.getState().pendingCityChange).toBeNull();
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
