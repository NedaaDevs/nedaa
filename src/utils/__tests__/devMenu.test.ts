import { registerDevMenuItems } from "expo-dev-menu";

import { CITY_CHECK_OFFER, REUSE_FIX_MAX_AGE_MS } from "@/constants/CityCheck";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { offerShapeOf } from "@/components/location/cityOfferView";
import { CITY_OFFER_STAGE, OFFER_SHAPE } from "@/constants/CityOffer";
import { LocationMode } from "@/enums/location";
import { DUBAI_ZONE, RIYADH_CITY } from "@/test-helpers/place";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { AppLogger } from "@/utils/appLogger";
import { registerDevMenu } from "@/utils/devMenu";
import { clearCityCheckMemory, runCityCheckNow, showCityCheckMemory } from "@/utils/cityCheckDebug";
import { phoneZoneReadings } from "@/utils/phoneZone";

jest.mock("expo-dev-menu", () => ({ registerDevMenuItems: jest.fn(() => Promise.resolve()) }));

// The sample offers run for real; the check's own actions are stubbed.
jest.mock("@/utils/cityCheckDebug", () => ({
  ...jest.requireActual("@/utils/cityCheckDebug"),
  runCityCheckNow: jest.fn(),
  showCityCheckMemory: jest.fn(),
  clearCityCheckMemory: jest.fn(),
}));

jest.mock("@/utils/phoneZone", () => ({ phoneZoneReadings: jest.fn() }));

const UNNAMED_SAMPLE_KM = 40;
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

// A check needs a real move; QA puts an offer up from here instead.
const itemNamed = (name: string) =>
  (jest.mocked(registerDevMenuItems).mock.lastCall?.[0] ?? []).find((item) => item.name === name);

it("lists the items in menu order", () => {
  setDevBuild(true);

  registerDevMenu();

  const items = jest.mocked(registerDevMenuItems).mock.lastCall?.[0] ?? [];
  expect(items.map(({ name }) => name)).toEqual([
    DEBUG_COPY.RESTART_ONBOARDING,
    DEBUG_COPY.SHOW_CITY_CHANGE,
    DEBUG_COPY.SHOW_CITY_CHANGE_SAME_CITY,
    DEBUG_COPY.SHOW_CITY_CHANGE_UNNAMED,
    DEBUG_COPY.LOG_PHONE_ZONE,
    DEBUG_COPY.RUN_CITY_CHECK,
    DEBUG_COPY.SHOW_CITY_CHECK_MEMORY,
    DEBUG_COPY.CLEAR_CITY_CHECK_MEMORY,
  ]);
});

describe("the sample city offers", () => {
  beforeEach(() => {
    setDevBuild(true);
    useLocationStore.setState({
      locationMode: LocationMode.DEVICE,
      cityOffer: null,
      localizedLocation: { city: RIYADH_CITY.name, country: RIYADH_CITY.country.name },
    });
  });

  it("adds Show city change, offering a named sample city", () => {
    registerDevMenu();
    itemNamed(DEBUG_COPY.SHOW_CITY_CHANGE)?.callback();

    const offer = useLocationStore.getState().cityOffer;
    expect(offer?.candidate.name?.name).toBe(DEBUG_COPY.SAMPLE_NEW_CITY);
    expect(offer?.reasons).toEqual([CITY_CHECK_OFFER.SHIFT]);
  });

  it("adds Show unnamed city change, offering a place 40 km away", () => {
    registerDevMenu();
    itemNamed(DEBUG_COPY.SHOW_CITY_CHANGE_UNNAMED)?.callback();

    const offer = useLocationStore.getState().cityOffer;
    expect(offer?.candidate.name).toBeNull();
    expect(offer?.candidate.distanceKm).toBe(UNNAMED_SAMPLE_KM);
  });

  // A Use from a sample reads the device, never the sample's point.
  it("dates each sample too old to reuse", () => {
    registerDevMenu();
    itemNamed(DEBUG_COPY.SHOW_CITY_CHANGE)?.callback();

    const fixedAt = useLocationStore.getState().cityOffer?.candidate.fixedAt ?? Date.now();
    expect(Date.now() - fixedAt).toBeGreaterThan(REUSE_FIX_MAX_AGE_MS);
  });

  it.each([
    [DEBUG_COPY.SHOW_CITY_CHANGE, OFFER_SHAPE.NAMED],
    [DEBUG_COPY.SHOW_CITY_CHANGE_SAME_CITY, OFFER_SHAPE.SAME_NAME],
    [DEBUG_COPY.SHOW_CITY_CHANGE_UNNAMED, OFFER_SHAPE.UNNAMED],
  ])("adds %s, putting an unanswered offer of that shape up", (name, shape) => {
    registerDevMenu();
    itemNamed(name)?.callback();

    const offer = useLocationStore.getState().cityOffer;
    expect(offer?.stage.kind).toBe(CITY_OFFER_STAGE.OFFER);
    expect(
      offerShapeOf({ here: offer?.candidate.name?.name ?? null, saved: RIYADH_CITY.name })
    ).toBe(shape);
  });

  it("names the Dubai sample on Dubai's zone, so the zone line shows", () => {
    registerDevMenu();
    itemNamed(DEBUG_COPY.SHOW_CITY_CHANGE)?.callback();

    const candidate = useLocationStore.getState().cityOffer?.candidate;
    expect(candidate?.name?.name).toBe(DEBUG_COPY.SAMPLE_NEW_CITY);
    expect(candidate?.zone).toBe(DUBAI_ZONE);
  });

  it.each([
    DEBUG_COPY.SHOW_CITY_CHANGE,
    DEBUG_COPY.SHOW_CITY_CHANGE_SAME_CITY,
    DEBUG_COPY.SHOW_CITY_CHANGE_UNNAMED,
  ])("offers nothing over a chosen city from %s", (name) => {
    useLocationStore.setState({ locationMode: LocationMode.MANUAL });
    registerDevMenu();
    itemNamed(name)?.callback();

    expect(useLocationStore.getState().cityOffer).toBeNull();
  });
});

it("adds Log the phone zone, logging both readings", () => {
  setDevBuild(true);
  const info = jest.spyOn(AppLogger.create("app"), "i").mockImplementation(() => {});
  jest.mocked(phoneZoneReadings).mockReturnValue({ intl: "Asia/Dubai", calendar: "Asia/Riyadh" });

  registerDevMenu();

  const items = jest.mocked(registerDevMenuItems).mock.lastCall?.[0] ?? [];
  items.find(({ name }) => name === DEBUG_COPY.LOG_PHONE_ZONE)?.callback();
  expect(info).toHaveBeenCalledWith("DevMenu", expect.stringContaining("Asia/Dubai"));
  expect(info).toHaveBeenCalledWith("DevMenu", expect.stringContaining("Asia/Riyadh"));
});

it.each([
  [DEBUG_COPY.RUN_CITY_CHECK, runCityCheckNow],
  [DEBUG_COPY.SHOW_CITY_CHECK_MEMORY, showCityCheckMemory],
  [DEBUG_COPY.CLEAR_CITY_CHECK_MEMORY, clearCityCheckMemory],
])("adds %s, running its shared action", (name, action) => {
  setDevBuild(true);
  registerDevMenu();

  itemNamed(name)?.callback();

  expect(action).toHaveBeenCalledTimes(1);
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
