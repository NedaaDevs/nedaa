const mockPermission = {
  status: "granted",
  granted: true,
  canAskAgain: true,
  expires: "never",
  android: { accuracy: "fine" },
} as const;

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

describe("location adapter", () => {
  beforeEach(() => {
    jest.dontMock("expo-hms-location");
    jest.dontMock("expo-location");
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock("expo-hms-location");
    jest.dontMock("expo-location");
    jest.resetModules();
  });

  it("uses Huawei Location Kit when the HMS native module is available", async () => {
    const hmsGetCurrentPositionAsync = jest.fn().mockResolvedValue(mockLocation);

    jest.doMock("expo-hms-location", () => ({
      ExpoHmsLocationModule: {
        isAvailable: true,
        getCurrentPositionAsync: hmsGetCurrentPositionAsync,
      },
    }));
    jest.doMock("expo-location", () => {
      throw new Error("GMS location must not load in an HMS build");
    });

    let isolatedLocation: typeof import("@/adapters/location") | undefined;
    jest.isolateModules(() => {
      isolatedLocation =
        jest.requireActual<typeof import("@/adapters/location")>("@/adapters/location");
    });
    const Location = isolatedLocation!;

    await expect(
      Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.LOW })
    ).resolves.toEqual(mockLocation);
    expect(hmsGetCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.LocationAccuracy.LOW,
    });
  });

  it.each([true, false])("says whether Huawei Location Kit reads the position (%s)", (hms) => {
    jest.doMock("expo-hms-location", () => ({ ExpoHmsLocationModule: { isAvailable: hms } }));

    let isolatedLocation: typeof import("@/adapters/location") | undefined;
    jest.isolateModules(() => {
      isolatedLocation =
        jest.requireActual<typeof import("@/adapters/location")>("@/adapters/location");
    });

    expect(isolatedLocation!.usesHmsLocation()).toBe(hms);
  });

  it("uses Expo Location when the HMS native module is absent", async () => {
    const expoGetForegroundPermissionsAsync = jest.fn().mockResolvedValue(mockPermission);

    jest.doMock("expo-hms-location", () => ({
      ExpoHmsLocationModule: { isAvailable: false },
    }));
    jest.doMock("expo-location", () => ({
      getForegroundPermissionsAsync: expoGetForegroundPermissionsAsync,
    }));

    let isolatedLocation: typeof import("@/adapters/location") | undefined;
    jest.isolateModules(() => {
      isolatedLocation =
        jest.requireActual<typeof import("@/adapters/location")>("@/adapters/location");
    });
    const Location = isolatedLocation!;

    await expect(Location.getForegroundPermissionsAsync()).resolves.toEqual(mockPermission);
    expect(expoGetForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  describe("getLastKnownPositionAsync", () => {
    const MAX_AGE_MS = 60_000;
    const NOW = 1_750_000_000_000;

    const loadAdapter = () => {
      let isolated: typeof import("@/adapters/location") | undefined;
      jest.isolateModules(() => {
        isolated = jest.requireActual<typeof import("@/adapters/location")>("@/adapters/location");
      });
      return isolated!;
    };

    const mockHms = (lastKnown: unknown) => {
      jest.doMock("expo-hms-location", () => ({
        ExpoHmsLocationModule: {
          isAvailable: true,
          getLastKnownPositionAsync: jest.fn().mockResolvedValue(lastKnown),
        },
      }));
      jest.doMock("expo-location", () => {
        throw new Error("GMS location must not load in an HMS build");
      });
    };

    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(NOW);
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("asks Expo Location for a fix no older than the max age", async () => {
      const expoGetLastKnown = jest.fn().mockResolvedValue(mockLocation);
      jest.doMock("expo-hms-location", () => ({ ExpoHmsLocationModule: { isAvailable: false } }));
      jest.doMock("expo-location", () => ({ getLastKnownPositionAsync: expoGetLastKnown }));

      await expect(loadAdapter().getLastKnownPositionAsync(MAX_AGE_MS)).resolves.toEqual(
        mockLocation
      );
      expect(expoGetLastKnown).toHaveBeenCalledWith({ maxAge: MAX_AGE_MS });
    });

    it("keeps a Huawei fix within the max age", async () => {
      const recent = { ...mockLocation, timestamp: NOW - MAX_AGE_MS };
      mockHms(recent);

      await expect(loadAdapter().getLastKnownPositionAsync(MAX_AGE_MS)).resolves.toEqual(recent);
    });

    it("drops a Huawei fix older than the max age", async () => {
      mockHms({ ...mockLocation, timestamp: NOW - MAX_AGE_MS - 1 });

      await expect(loadAdapter().getLastKnownPositionAsync(MAX_AGE_MS)).resolves.toBeNull();
    });

    it("passes on a missing Huawei fix as null", async () => {
      mockHms(null);

      await expect(loadAdapter().getLastKnownPositionAsync(MAX_AGE_MS)).resolves.toBeNull();
    });
  });
});
