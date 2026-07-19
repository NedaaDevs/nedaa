type Listener = (event: unknown) => void;

type MockNativeModule = {
  getCurrentPositionAsync: jest.Mock;
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  hasServicesEnabledAsync: jest.Mock;
  reverseGeocodeAsync: jest.Mock;
  startWatchingAsync: jest.Mock;
  stopWatchingAsync: jest.Mock;
};

const loadSubject = () => {
  const nativeModule: MockNativeModule = {
    getCurrentPositionAsync: jest.fn(),
    getForegroundPermissionsAsync: jest.fn(),
    requestForegroundPermissionsAsync: jest.fn(),
    hasServicesEnabledAsync: jest.fn(),
    reverseGeocodeAsync: jest.fn(),
    startWatchingAsync: jest.fn(),
    stopWatchingAsync: jest.fn(),
  };
  const listeners = new Map<string, Set<Listener>>();

  jest.doMock("expo-modules-core", () => ({
    ...jest.requireActual("expo-modules-core"),
    requireOptionalNativeModule: () => nativeModule,
    EventEmitter: class MockEventEmitter {
      addListener(eventName: string, listener: Listener) {
        const eventListeners = listeners.get(eventName) ?? new Set<Listener>();
        eventListeners.add(listener);
        listeners.set(eventName, eventListeners);
        return { remove: () => eventListeners.delete(listener) };
      }
    },
  }));

  let subject: typeof import("../index").ExpoHmsLocationModule;
  jest.isolateModules(() => {
    subject = jest.requireActual<typeof import("../index")>("../index").ExpoHmsLocationModule;
  });

  return {
    ExpoHmsLocationModule: subject!,
    nativeModule,
    emit: (eventName: string, event: unknown) => {
      listeners.get(eventName)?.forEach((listener) => listener(event));
    },
  };
};

describe("ExpoHmsLocationModule", () => {
  afterEach(() => {
    jest.dontMock("expo-modules-core");
    jest.resetModules();
  });

  it("reports the native module as available", () => {
    const { ExpoHmsLocationModule } = loadSubject();

    expect(ExpoHmsLocationModule.isAvailable).toBe(true);
  });

  it("delegates one-shot position requests to the native module", async () => {
    const { ExpoHmsLocationModule, nativeModule } = loadSubject();
    const position = {
      coords: {
        latitude: 24.7136,
        longitude: 46.6753,
        altitude: null,
        accuracy: 15,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1_750_000_000_000,
      mocked: false,
    };
    nativeModule.getCurrentPositionAsync.mockResolvedValue(position);

    await expect(ExpoHmsLocationModule.getCurrentPositionAsync({ accuracy: 2 })).resolves.toEqual(
      position
    );
    expect(nativeModule.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 2 });
  });

  it("routes watch events by id and removes the native watch", async () => {
    const { ExpoHmsLocationModule, emit, nativeModule } = loadSubject();
    nativeModule.startWatchingAsync.mockResolvedValue(undefined);
    nativeModule.stopWatchingAsync.mockResolvedValue(undefined);
    const first = jest.fn();
    const second = jest.fn();

    const firstSubscription = await ExpoHmsLocationModule.watchPositionAsync(
      { accuracy: 4 },
      first
    );
    await ExpoHmsLocationModule.watchPositionAsync({ accuracy: 4 }, second);

    const firstWatchId = nativeModule.startWatchingAsync.mock.calls[0][0];
    const secondWatchId = nativeModule.startWatchingAsync.mock.calls[1][0];
    const position = {
      coords: {
        latitude: 21.4225,
        longitude: 39.8262,
        altitude: null,
        accuracy: 10,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1_750_000_000_000,
    };

    emit("onLocationUpdate", { watchId: secondWatchId, location: position });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(position);

    firstSubscription.remove();
    expect(nativeModule.stopWatchingAsync).toHaveBeenCalledWith(firstWatchId);
  });

  it("handles a native watch cleanup rejection", async () => {
    const { ExpoHmsLocationModule, nativeModule } = loadSubject();
    const stopFailure = { catch: jest.fn() };
    nativeModule.startWatchingAsync.mockResolvedValue(undefined);
    nativeModule.stopWatchingAsync.mockReturnValue(stopFailure);

    const subscription = await ExpoHmsLocationModule.watchPositionAsync({ accuracy: 4 }, jest.fn());
    subscription.remove();

    expect(stopFailure.catch).toHaveBeenCalledWith(expect.any(Function));
  });
});
