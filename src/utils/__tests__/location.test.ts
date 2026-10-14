import { getCurrentPositionAsync, getForegroundPermissionsAsync } from "@/adapters/location";

// Enums
import { LocalPermissionStatus } from "@/enums/location";

import { never, outcomeOf } from "@/test-helpers/promises";
import { AppLogger } from "@/utils/appLogger";
import { LocationPermissionError, getLocationWithTimeout } from "@/utils/location";

jest.mock("@/adapters/location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  LocationAccuracy: { LOW: 2, HIGH: 4 },
}));

// One logger for every domain, so a test can read what the module logged.
jest.mock("@/utils/appLogger", () => {
  const log = { d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() };
  return { AppLogger: { create: () => log } };
});
const log = AppLogger.create("location");

const mockGetForegroundPermissionsAsync = getForegroundPermissionsAsync as jest.Mock;
const mockGetCurrentPositionAsync = getCurrentPositionAsync as jest.Mock;

const mockLocation = {
  coords: {
    latitude: 24.7136,
    longitude: 46.6753,
    altitude: 612,
    accuracy: 12,
    altitudeAccuracy: 5,
    heading: 0,
    speed: 0,
  },
  timestamp: 1_750_000_000_000,
  mocked: false,
};

describe("location permission gating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getLocationWithTimeout", () => {
    it("throws LocationPermissionError without calling the native provider when permission is not granted", async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue({
        status: LocalPermissionStatus.DENIED,
        canAskAgain: true,
      });

      await expect(getLocationWithTimeout()).rejects.toThrow(LocationPermissionError);
      expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it("resolves with the location when permission is granted", async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue({
        status: LocalPermissionStatus.GRANTED,
        canAskAgain: true,
      });
      mockGetCurrentPositionAsync.mockResolvedValue(mockLocation);

      await expect(getLocationWithTimeout()).resolves.toEqual(mockLocation);
    });

    it("logs a denied permission as a skip, not as a failed request", async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue({
        status: LocalPermissionStatus.DENIED,
        canAskAgain: true,
      });

      await expect(getLocationWithTimeout()).rejects.toThrow(LocationPermissionError);
      expect(log.w).toHaveBeenCalledTimes(1);
      expect(log.e).not.toHaveBeenCalled();
    });
  });

  // One deadline covers the permission check and the fix together.
  describe("getLocationWithTimeout's deadline", () => {
    const DEADLINE_MS = 1000;
    const GRANTED = { status: LocalPermissionStatus.GRANTED, canAskAgain: true };
    /** A permission check that answers granted after `ms`. */
    const grantedAfter = (ms: number) =>
      mockGetForegroundPermissionsAsync.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(GRANTED), ms))
      );

    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it("rejects at its timeout when the permission check never answers", async () => {
      mockGetForegroundPermissionsAsync.mockReturnValue(never());
      const outcome = outcomeOf(getLocationWithTimeout(DEADLINE_MS));

      await jest.advanceTimersByTimeAsync(DEADLINE_MS - 1);
      expect(outcome).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      expect(outcome).toHaveBeenCalledWith({
        error: expect.objectContaining({ message: "Location request timed out" }),
      });
      expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it("counts the check's time against the same deadline as the fix", async () => {
      grantedAfter(DEADLINE_MS / 2);
      mockGetCurrentPositionAsync.mockReturnValue(never());
      const outcome = outcomeOf(getLocationWithTimeout(DEADLINE_MS));

      await jest.advanceTimersByTimeAsync(DEADLINE_MS - 1);
      expect(mockGetCurrentPositionAsync).toHaveBeenCalledTimes(1);
      expect(outcome).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      expect(outcome).toHaveBeenCalledWith({
        error: expect.objectContaining({ message: "Location request timed out" }),
      });
    });

    it("starts no fix when the check answers after the deadline", async () => {
      grantedAfter(DEADLINE_MS * 2);
      const outcome = outcomeOf(getLocationWithTimeout(DEADLINE_MS));

      await jest.advanceTimersByTimeAsync(DEADLINE_MS * 3);

      expect(outcome).toHaveBeenCalledTimes(1);
      expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it("clears its deadline once the fix lands", async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue(GRANTED);
      mockGetCurrentPositionAsync.mockResolvedValue(mockLocation);

      await expect(getLocationWithTimeout(DEADLINE_MS)).resolves.toEqual(mockLocation);
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
