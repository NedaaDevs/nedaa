import React from "react";
import renderer, { act } from "react-test-renderer";

import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { useLocationStore } from "@/stores/location";
import { initialLocationDetails, type ManualLocation } from "@/types/location";
import { LocationMode } from "@/enums/location";

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

const RIYADH: ManualLocation = {
  cityId: 108410,
  name: "Riyadh",
  names: { ar: "الرياض", ur: null, ms: null },
  region: null,
  countryCode: "SA",
  country: { name: "Saudi Arabia", names: { ar: "السعودية", ur: null, ms: null } },
  latitude: 24.68773,
  longitude: 46.72185,
  timezone: "Asia/Riyadh",
};

let root: renderer.ReactTestRenderer | null = null;

// useLocationUpdate subscribes to the location store, so a Probe left mounted from an
// earlier test re-renders on every store write and appends its own stale state to
// `results`. Each test therefore mounts one Probe and unmounts it afterwards.
const mountProbe = async () => {
  await act(async () => {
    root = renderer.create(<Probe />);
    await Promise.resolve();
  });
};

const unmountProbe = async () => {
  if (!root) return;
  const current = root;
  root = null;
  await act(async () => {
    current.unmount();
  });
};

describe("applyManualLocation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    results.length = 0;
    jest.clearAllMocks();
    mockLoadPrayerTimes.mockResolvedValue(undefined);
    mockScheduleNotifications.mockResolvedValue(undefined);
    mockRescheduleAlarms.mockResolvedValue(undefined);
    useLocationStore.setState({
      locationDetails: initialLocationDetails,
      localizedLocation: { country: "", city: "" },
      lastKnownCoords: null,
      locationMode: LocationMode.DEVICE,
      manualLocation: null,
    });
  });

  afterEach(async () => {
    await unmountProbe();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("stores the chosen city without reading the device position", async () => {
    await mountProbe();
    await act(async () => {
      await latest().applyManualLocation(RIYADH);
    });

    expect(useLocationStore.getState().manualLocation).toEqual(RIYADH);
    expect(useLocationStore.getState().locationMode).toBe(LocationMode.MANUAL);
    expect(mockGetLocationWithTimeout).not.toHaveBeenCalled();
  });

  it("refreshes prayer times, notifications, alarms and widgets", async () => {
    await mountProbe();
    await act(async () => {
      await latest().applyManualLocation(RIYADH);
    });

    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
    expect(mockScheduleNotifications).toHaveBeenCalled();
    expect(mockRescheduleAlarms).toHaveBeenCalled();
    expect(mockReloadPrayerWidgets).toHaveBeenCalled();
  });

  it("reports success so the caller can dismiss the picker", async () => {
    let applied: boolean | undefined;

    await mountProbe();
    await act(async () => {
      applied = await latest().applyManualLocation(RIYADH);
    });

    expect(applied).toBe(true);
    expect(latest().updateState.error).toBeNull();
    expect(latest().updateState.currentStep).toBe("done");
  });

  it("reports failure so the caller keeps the picker open", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));
    let applied: boolean | undefined;

    await mountProbe();
    await act(async () => {
      applied = await latest().applyManualLocation(RIYADH);
    });

    expect(applied).toBe(false);
  });

  it("reports the failing step when the prayer-times refresh throws", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));

    await mountProbe();
    await act(async () => {
      await latest().applyManualLocation(RIYADH);
    });

    expect(latest().updateState.error).toEqual({
      step: "prayerTimes",
      message: "network down",
    });
  });

  it("stops the pipeline after a failing step rather than half-applying the change", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));

    await mountProbe();
    await act(async () => {
      await latest().applyManualLocation(RIYADH);
    });

    expect(mockScheduleNotifications).not.toHaveBeenCalled();
    expect(mockRescheduleAlarms).not.toHaveBeenCalled();
    expect(mockReloadPrayerWidgets).not.toHaveBeenCalled();
  });

  it("keeps the chosen city even when a later step fails, so a retry does not lose it", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));

    await mountProbe();
    await act(async () => {
      await latest().applyManualLocation(RIYADH);
    });

    expect(useLocationStore.getState().manualLocation).toEqual(RIYADH);
  });
});
