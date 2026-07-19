import React from "react";
import renderer, { act } from "react-test-renderer";

import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { useLocationStore } from "@/stores/location";
import { initialLocationDetails } from "@/types/location";

const mockGetLocationWithTimeout = jest.fn();
const mockLoadPrayerTimes = jest.fn();
const mockScheduleNotifications = jest.fn();
const mockRescheduleAlarms = jest.fn();
const mockReloadPrayerWidgets = jest.fn();

jest.mock("expo-location", () => ({
  reverseGeocodeAsync: jest.fn(),
}));

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/utils/location", () => ({
  CITY_CHANGE_THRESHOLD: 10,
  calculateDistance: jest.fn(),
  getLocationWithTimeout: (...args: unknown[]) => mockGetLocationWithTimeout(...args),
}));

jest.mock("@/stores/app", () => ({
  __esModule: true,
  default: {
    getState: () => ({ locale: "en" }),
  },
}));

jest.mock("@/api/geocodeApi", () => ({
  geocodeApi: { reverseGeocode: jest.fn() },
}));

jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: () => ({ loadPrayerTimes: mockLoadPrayerTimes }),
}));

jest.mock("@/stores/notification", () => ({
  useNotificationStore: () => ({ scheduleAllNotifications: mockScheduleNotifications }),
}));

jest.mock("@/utils/alarmScheduler", () => ({
  rescheduleAllAlarms: (...args: unknown[]) => mockRescheduleAlarms(...args),
}));

jest.mock("../../../modules/expo-widget/src", () => ({
  reloadPrayerWidgets: (...args: unknown[]) => mockReloadPrayerWidgets(...args),
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));

type HookValue = ReturnType<typeof useLocationUpdate>;
const results: HookValue[] = [];

const Probe = () => {
  results.push(useLocationUpdate());
  return null;
};

const latest = () => results[results.length - 1];

describe("useLocationUpdate location fail-safe", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    results.length = 0;
    jest.clearAllMocks();
    mockGetLocationWithTimeout.mockRejectedValue(new Error("HMS location unavailable"));
    mockLoadPrayerTimes.mockResolvedValue(undefined);
    mockScheduleNotifications.mockResolvedValue(undefined);
    mockRescheduleAlarms.mockResolvedValue(undefined);
    useLocationStore.setState({
      locationDetails: initialLocationDetails,
      localizedLocation: { country: "", city: "" },
      isLocationPermissionGranted: false,
      isGettingLocation: false,
      lastKnownCoords: null,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("stops the refresh pipeline when current location acquisition fails", async () => {
    await act(async () => {
      renderer.create(<Probe />);
      await Promise.resolve();
    });

    await act(async () => {
      await latest().executeUpdate();
    });

    expect(latest().updateState.error).toEqual({
      step: "location",
      message: "HMS location unavailable",
    });
    expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
    expect(mockScheduleNotifications).not.toHaveBeenCalled();
    expect(mockRescheduleAlarms).not.toHaveBeenCalled();
    expect(mockReloadPrayerWidgets).not.toHaveBeenCalled();
  });
});
