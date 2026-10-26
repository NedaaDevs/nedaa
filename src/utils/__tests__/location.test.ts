import {
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  getLastKnownPositionAsync,
  hasServicesEnabledAsync,
} from "@/adapters/location";

import { FIX_SOURCE, LOCATION_FAILURE, type LocationFailure } from "@/constants/Location";

// Enums
import { LocalPermissionStatus } from "@/enums/location";

import { never, outcomeOf } from "@/test-helpers/promises";
import { AppLogger } from "@/utils/appLogger";
import {
  LAST_KNOWN_MAX_AGE_MS,
  LAST_KNOWN_REQUEST_TIMEOUT,
  LocationFixError,
  LocationPermissionError,
  getLocationWithTimeout,
  readLocation,
} from "@/utils/location";

jest.mock("@/adapters/location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
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
const mockGetLastKnownPositionAsync = getLastKnownPositionAsync as jest.Mock;
const mockHasServicesEnabledAsync = hasServicesEnabledAsync as jest.Mock;

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
    mockGetLastKnownPositionAsync.mockResolvedValue(null);
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

describe("readLocation", () => {
  const DEADLINE_MS = 1000;
  const GRANTED = { status: LocalPermissionStatus.GRANTED, canAskAgain: true };
  const nativeFailure = new Error("kCLErrorLocationUnknown");

  /** The failure kind `readLocation` rejected with. */
  const failureOf = async (read: Promise<unknown>): Promise<LocationFailure | undefined> => {
    try {
      await read;
    } catch (error) {
      if (error instanceof LocationFixError) return error.kind;
      throw error;
    }
    return undefined;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetForegroundPermissionsAsync.mockResolvedValue(GRANTED);
    mockGetLastKnownPositionAsync.mockResolvedValue(null);
    mockHasServicesEnabledAsync.mockResolvedValue(true);
  });

  it("returns a fresh fix without checking services or the cached fix", async () => {
    mockGetCurrentPositionAsync.mockResolvedValue(mockLocation);

    await expect(readLocation(DEADLINE_MS)).resolves.toEqual({
      location: mockLocation,
      source: FIX_SOURCE.FRESH,
    });
    expect(mockHasServicesEnabledAsync).not.toHaveBeenCalled();
    expect(mockGetLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it("fails as denied with no native read and no fallback", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      status: LocalPermissionStatus.DENIED,
      canAskAgain: true,
    });

    const read = readLocation(DEADLINE_MS);
    await expect(read).rejects.toBeInstanceOf(LocationPermissionError);
    expect(await failureOf(read)).toBe(LOCATION_FAILURE.DENIED);
    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
    expect(mockGetLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  describe("after the deadline", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockGetCurrentPositionAsync.mockReturnValue(never());
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it("uses a cached fix younger than the max age", async () => {
      mockGetLastKnownPositionAsync.mockResolvedValue(mockLocation);
      const outcome = outcomeOf(readLocation(DEADLINE_MS));

      await jest.advanceTimersByTimeAsync(DEADLINE_MS);

      expect(outcome).toHaveBeenCalledWith({
        value: { location: mockLocation, source: FIX_SOURCE.LAST_KNOWN },
      });
      expect(mockGetLastKnownPositionAsync).toHaveBeenCalledWith(LAST_KNOWN_MAX_AGE_MS);
      expect(mockHasServicesEnabledAsync).not.toHaveBeenCalled();
    });

    it("fails as a timeout when no cached fix is held", async () => {
      const outcome = outcomeOf(readLocation(DEADLINE_MS));

      await jest.advanceTimersByTimeAsync(DEADLINE_MS);

      expect(outcome).toHaveBeenCalledWith({
        error: expect.objectContaining({ kind: LOCATION_FAILURE.TIMEOUT }),
      });
    });
  });

  describe("after a native failure with services on", () => {
    beforeEach(() => {
      mockGetCurrentPositionAsync.mockRejectedValue(nativeFailure);
    });

    it("uses a cached fix younger than the max age", async () => {
      mockGetLastKnownPositionAsync.mockResolvedValue(mockLocation);

      await expect(readLocation(DEADLINE_MS)).resolves.toEqual({
        location: mockLocation,
        source: FIX_SOURCE.LAST_KNOWN,
      });
      expect(mockHasServicesEnabledAsync).toHaveBeenCalledTimes(1);
    });

    it("fails as unavailable when no cached fix is held", async () => {
      expect(await failureOf(readLocation(DEADLINE_MS))).toBe(LOCATION_FAILURE.UNAVAILABLE);
    });

    it("fails as unavailable when the services check itself fails", async () => {
      mockHasServicesEnabledAsync.mockRejectedValue(new Error("no manager"));

      expect(await failureOf(readLocation(DEADLINE_MS))).toBe(LOCATION_FAILURE.UNAVAILABLE);
    });

    describe("when the cached-fix read stalls", () => {
      beforeEach(() => {
        jest.useFakeTimers();
        mockGetLastKnownPositionAsync.mockReturnValue(never());
      });
      afterEach(() => {
        jest.useRealTimers();
      });

      it("fails as unavailable, not held by the stalled read", async () => {
        const outcome = outcomeOf(readLocation(DEADLINE_MS));

        await jest.advanceTimersByTimeAsync(LAST_KNOWN_REQUEST_TIMEOUT);

        expect(outcome).toHaveBeenCalledWith({
          error: expect.objectContaining({ kind: LOCATION_FAILURE.UNAVAILABLE }),
        });
      });
    });
  });

  it("fails as services off with no fallback after a native failure", async () => {
    mockGetCurrentPositionAsync.mockRejectedValue(nativeFailure);
    mockHasServicesEnabledAsync.mockResolvedValue(false);
    mockGetLastKnownPositionAsync.mockResolvedValue(mockLocation);

    expect(await failureOf(readLocation(DEADLINE_MS))).toBe(LOCATION_FAILURE.SERVICES_OFF);
    expect(mockGetLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it("keeps the original failure when the cached-fix read fails", async () => {
    mockGetCurrentPositionAsync.mockRejectedValue(nativeFailure);
    mockGetLastKnownPositionAsync.mockRejectedValue(new Error("cache read failed"));

    expect(await failureOf(readLocation(DEADLINE_MS))).toBe(LOCATION_FAILURE.UNAVAILABLE);
  });

  it("returns only the position through getLocationWithTimeout", async () => {
    mockGetCurrentPositionAsync.mockRejectedValue(nativeFailure);
    mockGetLastKnownPositionAsync.mockResolvedValue(mockLocation);

    await expect(getLocationWithTimeout(DEADLINE_MS)).resolves.toEqual(mockLocation);
  });
});
