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
});
