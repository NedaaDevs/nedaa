import { act, renderHook } from "@testing-library/react-native";

import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { useLocationStore } from "@/stores/location";
import { initialLocationDetails, type ManualLocation } from "@/types/location";
import { LocationMode } from "@/enums/location";

const mockReadLocation = jest.fn();
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
  ...jest.requireActual("@/utils/location"),
  readLocation: (...args: unknown[]) => mockReadLocation(...args),
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

jest.mock("expo-widget", () => ({
  reloadPrayerWidgets: (...args: unknown[]) => mockReloadPrayerWidgets(...args),
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));

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

const mountHook = () => renderHook(() => useLocationUpdate());

describe("applyManualLocation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
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

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("stores the chosen city without reading the device position", async () => {
    const { result } = await mountHook();
    await act(async () => {
      await result.current.applyManualLocation(RIYADH);
    });

    expect(useLocationStore.getState().manualLocation).toEqual(RIYADH);
    expect(useLocationStore.getState().locationMode).toBe(LocationMode.MANUAL);
    expect(mockReadLocation).not.toHaveBeenCalled();
  });

  it("refreshes prayer times, notifications, alarms and widgets", async () => {
    const { result } = await mountHook();
    await act(async () => {
      await result.current.applyManualLocation(RIYADH);
    });

    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
    expect(mockScheduleNotifications).toHaveBeenCalled();
    expect(mockRescheduleAlarms).toHaveBeenCalled();
    expect(mockReloadPrayerWidgets).toHaveBeenCalled();
  });

  it("reports success so the caller can dismiss the picker", async () => {
    let applied: boolean | undefined;

    const { result } = await mountHook();
    await act(async () => {
      applied = await result.current.applyManualLocation(RIYADH);
    });

    expect(applied).toBe(true);
    expect(result.current.updateState.error).toBeNull();
    expect(result.current.updateState.currentStep).toBe("done");
  });

  it("reports failure so the caller keeps the picker open", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));
    let applied: boolean | undefined;

    const { result } = await mountHook();
    await act(async () => {
      applied = await result.current.applyManualLocation(RIYADH);
    });

    expect(applied).toBe(false);
  });

  it("reports the failing step when the prayer-times refresh throws", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));

    const { result } = await mountHook();
    await act(async () => {
      await result.current.applyManualLocation(RIYADH);
    });

    expect(result.current.updateState.error).toEqual({
      step: "prayerTimes",
      message: "network down",
    });
  });

  it("stops the pipeline after a failing step rather than half-applying the change", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));

    const { result } = await mountHook();
    await act(async () => {
      await result.current.applyManualLocation(RIYADH);
    });

    expect(mockScheduleNotifications).not.toHaveBeenCalled();
    expect(mockRescheduleAlarms).not.toHaveBeenCalled();
    expect(mockReloadPrayerWidgets).not.toHaveBeenCalled();
  });

  it("keeps the chosen city even when a later step fails, so a retry does not lose it", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));

    const { result } = await mountHook();
    await act(async () => {
      await result.current.applyManualLocation(RIYADH);
    });

    expect(useLocationStore.getState().manualLocation).toEqual(RIYADH);
  });

  it("retries a failed manual apply with the same city, not the device", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));
    const { result } = await mountHook();
    await act(async () => {
      await result.current.applyManualLocation(RIYADH);
    });

    await act(async () => {
      await result.current.retry();
    });

    expect(mockReadLocation).not.toHaveBeenCalled();
    expect(useLocationStore.getState().manualLocation).toEqual(RIYADH);
    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(2);
    expect(result.current.updateState.currentStep).toBe("done");
  });
});
