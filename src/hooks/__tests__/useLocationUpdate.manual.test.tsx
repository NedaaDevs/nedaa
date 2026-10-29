import { AccessibilityInfo, Platform } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import { reverseGeocodeAsync } from "expo-location";

import { geocodeApi } from "@/api/geocodeApi";

import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { useLocationStore } from "@/stores/location";
import { initialLocationDetails, type ManualLocation } from "@/types/location";
import { LocationMode } from "@/enums/location";
import {
  FIX_SOURCE,
  LOCATION_FAILURE,
  STEP_OUTCOME,
  UPDATE_START,
  UPDATE_STEP,
} from "@/constants/Location";
import { SchedulingSkipReason } from "@/enums/notifications";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { LocationFixError } from "@/utils/location";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";

const mockReadLocation = jest.fn();
const mockLoadPrayerTimes = jest.fn();
// The load that first takes a device fix: a point write, as the real one is.
const mockLoadWithFix = jest.fn(async () => {
  jest
    .requireActual("@/stores/location")
    .useLocationStore.setState((state: { placeRevision: number }) => ({
      placeRevision: state.placeRevision + 1,
    }));
  return true;
});
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
    getState: () => ({
      loadPrayerTimes: mockLoadWithFix,
      loadPrayerTimesAtCurrentPlace: mockLoadPrayerTimes,
    }),
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

/** Every step lands: the full window, alerts scheduled, alarms armed. */
const resolveSteps = () => {
  mockLoadPrayerTimes.mockResolvedValue(true);
  mockScheduleNotifications.mockResolvedValue({ success: true, scheduledCount: 5 });
  mockRescheduleAlarms.mockResolvedValue(STEP_OUTCOME.DONE);
};

beforeEach(() => useLocationUpdateStore.setState({ run: null }));

describe("applyManualLocation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resolveSteps();
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
    expect(result.current.run).toBeNull();
  });

  // The status line leaves with the run, so the end is said on both platforms.
  it.each([PlatformType.IOS, PlatformType.ANDROID])(
    "says on %s that the update landed",
    async (os) => {
      const platform = Platform.OS;
      Platform.OS = os;
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");

      const { result } = await mountHook();
      await act(async () => {
        await result.current.applyManualLocation(RIYADH);
      });

      expect(announce).toHaveBeenCalledWith(i18n.t("location.update.step.done"));
      Platform.OS = platform;
      announce.mockRestore();
    }
  );

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

    expect(result.current.run).toEqual({
      start: { kind: UPDATE_START.CITY, city: RIYADH },
      step: UPDATE_STEP.PRAYER_TIMES,
      failed: true,
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
    expect(result.current.run).toBeNull();
  });
});

const DEVICE_FIX = {
  location: {
    coords: {
      latitude: 21.4858,
      longitude: 39.1925,
      altitude: null,
      accuracy: 100,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: 1_750_000_000_000,
  },
  source: FIX_SOURCE.FRESH,
};

describe("switchToDevice", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.mocked(reverseGeocodeAsync).mockResolvedValue([]);
    // The translated name is fetched in the background; it never lands here.
    jest.mocked(geocodeApi.reverseGeocode).mockReturnValue(new Promise(() => {}));
    resolveSteps();
    useLocationStore.setState({
      locationDetails: initialLocationDetails,
      localizedLocation: { country: "", city: "" },
      lastKnownCoords: null,
      locationMode: LocationMode.DEVICE,
      manualLocation: null,
    });
    useLocationStore.getState().setManualLocation(RIYADH);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // A failed first fix leaves the times store owing a device fix.
  it("lands a device update without taking a second fix", async () => {
    useLocationStore.getState().clearManualLocation();
    mockReadLocation.mockResolvedValue(DEVICE_FIX);
    const { result } = await mountHook();

    let updated: boolean | undefined;
    await act(async () => {
      updated = await result.current.executeUpdate();
    });

    expect(updated).toBe(true);
    expect(mockLoadWithFix).not.toHaveBeenCalled();
    expect(mockScheduleNotifications).toHaveBeenCalled();
    expect(result.current.run).toBeNull();
  });

  it("replaces the chosen city with the device's fix and refreshes everything after it", async () => {
    mockReadLocation.mockResolvedValue(DEVICE_FIX);
    const { result } = await mountHook();

    let switched: boolean | undefined;
    await act(async () => {
      switched = await result.current.switchToDevice();
    });

    expect(switched).toBe(true);
    expect(useLocationStore.getState().locationMode).toBe(LocationMode.DEVICE);
    expect(useLocationStore.getState().manualLocation).toBeNull();
    expect(mockLoadPrayerTimes).toHaveBeenCalledWith(true);
    expect(mockRescheduleAlarms).toHaveBeenCalled();
  });

  it("keeps the chosen city when the read fails, and retries the switch itself", async () => {
    mockReadLocation
      .mockRejectedValueOnce(new LocationFixError(LOCATION_FAILURE.TIMEOUT))
      .mockResolvedValue(DEVICE_FIX);
    const { result } = await mountHook();
    await act(async () => {
      await result.current.switchToDevice();
    });
    expect(useLocationStore.getState().manualLocation).toEqual(RIYADH);
    expect(result.current.run?.step).toBe(UPDATE_STEP.LOCATION);

    await act(async () => {
      await result.current.retry();
    });

    expect(useLocationStore.getState().locationMode).toBe(LocationMode.DEVICE);
    expect(result.current.run).toBeNull();
  });
});

describe("dismissFailure", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resolveSteps();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("clears a failed run, so a reader who took another way sees no failure", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));
    const { result } = await mountHook();
    await act(async () => {
      await result.current.applyManualLocation(RIYADH);
    });

    await act(async () => result.current.dismissFailure());

    expect(result.current.run).toBeNull();
  });

  // The run goes on either way; hiding it would leave its result unexplained.
  it("leaves a running update on screen", async () => {
    mockLoadPrayerTimes.mockReturnValueOnce(new Promise(() => {}));
    const { result } = await mountHook();
    await act(async () => {
      void result.current.applyManualLocation(RIYADH);
    });

    await act(async () => result.current.dismissFailure());

    expect(result.current.run).toEqual({
      start: { kind: UPDATE_START.CITY, city: RIYADH },
      step: UPDATE_STEP.PRAYER_TIMES,
      failed: false,
    });
  });
});

// The run lives in a store, so every screen reads the one in flight.
describe("one run at a time", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveSteps();
  });

  // A fresh mount has no state of its own, so what it shows is the store's.
  it("shows a screen opened mid-run the run in flight", async () => {
    mockLoadPrayerTimes.mockReturnValueOnce(new Promise(() => {}));
    const first = await mountHook();
    await act(async () => {
      void first.result.current.applyManualLocation(RIYADH);
    });

    const reopened = await mountHook();

    expect(reopened.result.current.run?.step).toBe(UPDATE_STEP.PRAYER_TIMES);
    expect(reopened.result.current.run?.failed).toBe(false);
  });

  it("starts no second run while one is in flight", async () => {
    mockLoadPrayerTimes.mockReturnValueOnce(new Promise(() => {}));
    const { result } = await mountHook();
    await act(async () => {
      void result.current.applyManualLocation(RIYADH);
    });

    let started: boolean | undefined;
    await act(async () => {
      started = await result.current.executeUpdate();
    });

    expect(started).toBe(false);
    expect(mockReadLocation).not.toHaveBeenCalled();
    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(1);
  });

  // A screen opened after the failure retries the same city, not the device.
  it("retries the failed run's own start from a screen opened after it", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("network down"));
    const first = await mountHook();
    await act(async () => {
      await first.result.current.applyManualLocation(RIYADH);
    });
    mockLoadPrayerTimes.mockResolvedValue(true);

    const reopened = await mountHook();
    await act(async () => {
      await reopened.result.current.retry();
    });

    expect(mockReadLocation).not.toHaveBeenCalled();
    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(2);
    expect(reopened.result.current.run).toBeNull();
  });
});

describe("what the run reports", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resolveSteps();
    useLocationStore.setState({ locationMode: LocationMode.DEVICE, manualLocation: null });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const applyRiyadh = async () => {
    const hook = await mountHook();
    let applied: boolean | undefined;
    await act(async () => {
      applied = await hook.result.current.applyManualLocation(RIYADH);
    });
    return { result: hook.result, applied };
  };

  it("stops at notifications when none were scheduled, after moving the alarms", async () => {
    mockScheduleNotifications.mockResolvedValueOnce({
      success: false,
      scheduledCount: 0,
      failedCount: 3,
      error: new Error("os"),
    });
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");

    const { result, applied } = await applyRiyadh();

    expect(applied).toBe(false);
    expect(mockRescheduleAlarms).toHaveBeenCalled();
    expect(result.current.run).toEqual({
      start: { kind: UPDATE_START.CITY, city: RIYADH },
      step: UPDATE_STEP.NOTIFICATIONS,
      failed: true,
    });
    expect(announce).not.toHaveBeenCalledWith(i18n.t("location.update.step.done"));
    announce.mockRestore();
  });

  it("moves the alarms when scheduling notifications throws", async () => {
    mockScheduleNotifications.mockRejectedValueOnce(new Error("os"));

    const { result, applied } = await applyRiyadh();

    expect(applied).toBe(false);
    expect(mockRescheduleAlarms).toHaveBeenCalled();
    expect(result.current.run).toEqual(
      expect.objectContaining({ step: UPDATE_STEP.NOTIFICATIONS, failed: true })
    );
  });

  it("stops at notifications when only some were scheduled", async () => {
    mockScheduleNotifications.mockResolvedValueOnce({
      success: true,
      scheduledCount: 4,
      failedCount: 2,
    });

    const { result } = await applyRiyadh();

    expect(result.current.run).toEqual(
      expect.objectContaining({ step: UPDATE_STEP.NOTIFICATIONS, failed: true })
    );
  });

  it("lands when notifications are not allowed", async () => {
    mockScheduleNotifications.mockResolvedValueOnce({
      success: false,
      scheduledCount: 0,
      skipReason: SchedulingSkipReason.PERMISSION_NOT_GRANTED,
    });

    const { result, applied } = await applyRiyadh();

    expect(applied).toBe(true);
    expect(result.current.run).toBeNull();
  });

  it("stops at alarms when an enabled alarm was not armed", async () => {
    mockRescheduleAlarms.mockResolvedValueOnce(STEP_OUTCOME.PARTIAL);

    const { result } = await applyRiyadh();

    expect(result.current.run).toEqual(
      expect.objectContaining({ step: UPDATE_STEP.ALARMS, failed: true })
    );
  });

  it("lands when the widgets fail to reload after the last step", async () => {
    mockReloadPrayerWidgets.mockImplementationOnce(() => {
      throw new Error("widgets");
    });

    const { result, applied } = await applyRiyadh();

    expect(applied).toBe(true);
    expect(result.current.run).toBeNull();
  });

  it("lands while next year's times are still owed", async () => {
    mockLoadPrayerTimes.mockResolvedValueOnce(false);

    const { applied } = await applyRiyadh();

    expect(applied).toBe(true);
  });

  it("stops at the times step when the place is replaced during it", async () => {
    mockLoadPrayerTimes.mockImplementationOnce(async () => {
      useLocationStore.setState((state) => ({ placeRevision: state.placeRevision + 1 }));
      return false;
    });
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");

    const { result, applied } = await applyRiyadh();

    expect(applied).toBe(false);
    expect(result.current.run).toEqual(
      expect.objectContaining({ step: UPDATE_STEP.PRAYER_TIMES, failed: true })
    );
    expect(mockScheduleNotifications).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalledWith(i18n.t("location.update.step.done"));
    announce.mockRestore();
  });
});
