import { act, renderHook } from "@testing-library/react-native";

import { UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { initialLocationDetails } from "@/types/location";

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
  usePrayerTimesStore: {
    getState: () => ({ loadPrayerTimesAtCurrentPlace: mockLoadPrayerTimes }),
  },
}));

jest.mock("@/stores/notification", () => ({
  useNotificationStore: {
    getState: () => ({ scheduleAllNotifications: mockScheduleNotifications }),
  },
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

describe("useLocationUpdate location fail-safe", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockReadLocation.mockRejectedValue(new Error("HMS location unavailable"));
    mockLoadPrayerTimes.mockResolvedValue(undefined);
    mockScheduleNotifications.mockResolvedValue(undefined);
    mockRescheduleAlarms.mockResolvedValue(undefined);
    useLocationUpdateStore.setState({ run: null });
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
    const { result } = await renderHook(() => useLocationUpdate());

    await act(async () => {
      await result.current.executeUpdate();
    });

    expect(result.current.run).toEqual({
      start: { kind: UPDATE_START.DEVICE },
      step: UPDATE_STEP.LOCATION,
      failed: true,
    });
    expect(mockLoadPrayerTimes).not.toHaveBeenCalled();
    expect(mockScheduleNotifications).not.toHaveBeenCalled();
    expect(mockRescheduleAlarms).not.toHaveBeenCalled();
    expect(mockReloadPrayerWidgets).not.toHaveBeenCalled();
  });

  it("retries a failed device update with the device", async () => {
    const { result } = await renderHook(() => useLocationUpdate());
    await act(async () => {
      await result.current.executeUpdate();
    });

    await act(async () => {
      await result.current.retry();
    });

    expect(mockReadLocation).toHaveBeenCalledTimes(2);
  });
});
