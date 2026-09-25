import { HMS_LOCATION_EVENT, type HmsLocationEvents } from "../ExpoHmsLocation.types";

type Listener = (event: unknown) => void;

type MockNativeModule = {
  addListener: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  hasServicesEnabledAsync: jest.Mock;
  reverseGeocodeAsync: jest.Mock;
  startWatchingAsync: jest.Mock;
  stopWatchingAsync: jest.Mock;
};

const loadSubject = () => {
  const listeners = new Map<string, Set<Listener>>();
  const nativeModule: MockNativeModule = {
    addListener: jest.fn((eventName: string, listener: Listener) => {
      const eventListeners = listeners.get(eventName) ?? new Set<Listener>();
      eventListeners.add(listener);
      listeners.set(eventName, eventListeners);
      return { remove: () => eventListeners.delete(listener) };
    }),
    getCurrentPositionAsync: jest.fn(),
    getForegroundPermissionsAsync: jest.fn(),
    requestForegroundPermissionsAsync: jest.fn(),
    hasServicesEnabledAsync: jest.fn(),
    reverseGeocodeAsync: jest.fn(),
    startWatchingAsync: jest.fn(),
    stopWatchingAsync: jest.fn(),
  };

  jest.doMock("expo-modules-core", () => ({
    ...jest.requireActual("expo-modules-core"),
    requireOptionalNativeModule: () => nativeModule,
  }));

  let subject: typeof import("../index").ExpoHmsLocationModule;
  jest.isolateModules(() => {
    subject = jest.requireActual<typeof import("../index")>("../index").ExpoHmsLocationModule;
  });

  return {
    ExpoHmsLocationModule: subject!,
    nativeModule,
    emit: (eventName: keyof HmsLocationEvents, event: unknown) => {
      listeners.get(eventName)?.forEach((listener) => listener(event));
    },
    listenerCount: (eventName: keyof HmsLocationEvents) => listeners.get(eventName)?.size ?? 0,
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

    emit(HMS_LOCATION_EVENT.UPDATE, { watchId: secondWatchId, location: position });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(position);

    firstSubscription.remove();
    expect(nativeModule.stopWatchingAsync).toHaveBeenCalledWith(firstWatchId);
  });

  it("routes watch errors by id to the error callback", async () => {
    const { ExpoHmsLocationModule, emit, nativeModule } = loadSubject();
    nativeModule.startWatchingAsync.mockResolvedValue(undefined);
    const firstError = jest.fn();
    const secondError = jest.fn();

    await ExpoHmsLocationModule.watchPositionAsync({ accuracy: 4 }, jest.fn(), firstError);
    await ExpoHmsLocationModule.watchPositionAsync({ accuracy: 4 }, jest.fn(), secondError);

    const secondWatchId = nativeModule.startWatchingAsync.mock.calls[1][0];
    emit(HMS_LOCATION_EVENT.ERROR, { watchId: secondWatchId, reason: "timeout" });
    expect(firstError).not.toHaveBeenCalled();
    expect(secondError).toHaveBeenCalledWith("timeout");
  });

  it("detaches both native listeners on remove and stops the watch once", async () => {
    const { ExpoHmsLocationModule, listenerCount, nativeModule } = loadSubject();
    nativeModule.startWatchingAsync.mockResolvedValue(undefined);
    nativeModule.stopWatchingAsync.mockResolvedValue(undefined);

    const subscription = await ExpoHmsLocationModule.watchPositionAsync({ accuracy: 4 }, jest.fn());
    expect(listenerCount(HMS_LOCATION_EVENT.UPDATE)).toBe(1);
    expect(listenerCount(HMS_LOCATION_EVENT.ERROR)).toBe(1);

    subscription.remove();
    subscription.remove();
    expect(listenerCount(HMS_LOCATION_EVENT.UPDATE)).toBe(0);
    expect(listenerCount(HMS_LOCATION_EVENT.ERROR)).toBe(0);
    expect(nativeModule.stopWatchingAsync).toHaveBeenCalledTimes(1);
  });

  it("detaches both native listeners when the native watch fails to start", async () => {
    const { ExpoHmsLocationModule, listenerCount, nativeModule } = loadSubject();
    const startFailure = new Error("start failed");
    nativeModule.startWatchingAsync.mockRejectedValue(startFailure);

    await expect(ExpoHmsLocationModule.watchPositionAsync({ accuracy: 4 }, jest.fn())).rejects.toBe(
      startFailure
    );
    expect(nativeModule.addListener).toHaveBeenCalledTimes(2);
    expect(listenerCount(HMS_LOCATION_EVENT.UPDATE)).toBe(0);
    expect(listenerCount(HMS_LOCATION_EVENT.ERROR)).toBe(0);
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
