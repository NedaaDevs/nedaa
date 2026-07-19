import {
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
} from "@/adapters/location";

// Enums
import { LocalPermissionStatus } from "@/enums/location";

import {
  LocationPermissionError,
  getCurrentLocation,
  getLocationWithTimeout,
} from "@/utils/location";

jest.mock("@/adapters/location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  LocationAccuracy: { LOW: 2, HIGH: 4 },
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));

const mockGetForegroundPermissionsAsync = getForegroundPermissionsAsync as jest.Mock;
const mockRequestForegroundPermissionsAsync = requestForegroundPermissionsAsync as jest.Mock;
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
  });

  describe("getCurrentLocation", () => {
    it("returns a denied error without re-requesting when the permission is blocked", async () => {
      mockGetForegroundPermissionsAsync.mockResolvedValue({
        status: LocalPermissionStatus.DENIED,
        canAskAgain: false,
      });

      await expect(getCurrentLocation()).resolves.toEqual({ error: "Location permission denied" });
      expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
      expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it("re-requests and returns the location when denied but askable again and then granted", async () => {
      // First call is the initial gate in getCurrentLocation; the second is
      // getLocationWithTimeout's own gate, which reflects the OS state after the request grants it.
      mockGetForegroundPermissionsAsync
        .mockResolvedValueOnce({ status: LocalPermissionStatus.DENIED, canAskAgain: true })
        .mockResolvedValue({ status: LocalPermissionStatus.GRANTED, canAskAgain: true });
      mockRequestForegroundPermissionsAsync.mockResolvedValue({
        status: LocalPermissionStatus.GRANTED,
      });
      mockGetCurrentPositionAsync.mockResolvedValue(mockLocation);

      await expect(getCurrentLocation()).resolves.toEqual({ location: mockLocation });
      expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    });
  });
});
