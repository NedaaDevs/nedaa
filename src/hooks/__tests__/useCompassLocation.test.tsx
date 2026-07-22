import React from "react";
import renderer, { act } from "react-test-renderer";

import { CompassLocationSource, CompassReliabilityIssue } from "@/enums/compass";
import { useCompassLocation } from "@/hooks/useCompassLocation";
import { useCompassStore } from "@/stores/compass";
import { MAX_FRESH_LOCATION_AGE_MS, MAX_SAVED_LOCATION_AGE_MS } from "@/utils/compass";

const mockGetForegroundPermissionsAsync = jest.fn();
const mockRequestForegroundPermissionsAsync = jest.fn();
const mockHasServicesEnabledAsync = jest.fn();
const mockWatchPositionAsync = jest.fn();
const mockRemoveLocationWatch = jest.fn();

jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetForegroundPermissionsAsync(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...args),
  hasServicesEnabledAsync: (...args: unknown[]) => mockHasServicesEnabledAsync(...args),
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
}));

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));

type HookValue = ReturnType<typeof useCompassLocation>;
const results: HookValue[] = [];

const Probe = ({ active = true }: { active?: boolean }) => {
  results.push(useCompassLocation({ active }));
  return null;
};

const latest = () => results[results.length - 1];

const renderHook = async (active = true) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Probe active={active} />);
    await Promise.resolve();
  });
  return tree;
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const undeterminedPermission = {
  status: "undetermined",
  granted: false,
  canAskAgain: true,
  expires: "never",
};

const deniedPermission = {
  status: "denied",
  granted: false,
  canAskAgain: false,
  expires: "never",
};

const grantedPermission = {
  status: "granted",
  granted: true,
  canAskAgain: true,
  expires: "never",
  ios: { scope: "whenInUse", accuracy: "full" },
};

const precisePosition = {
  coords: {
    latitude: 24.7136,
    longitude: 46.6753,
    accuracy: 8,
    altitude: 612,
  },
  timestamp: Date.now(),
};

const useSuccessfulPosition = (position = precisePosition) => {
  mockWatchPositionAsync.mockImplementation(
    async (_options: unknown, callback: (location: typeof precisePosition) => void) => {
      callback(position);
      return { remove: mockRemoveLocationWatch };
    }
  );
};

describe("useCompassLocation", () => {
  beforeEach(() => {
    results.length = 0;
    jest.clearAllMocks();
    useCompassStore.setState({ lastVerifiedFix: null });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("silently checks permission on mount without prompting", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue(undeterminedPermission);
    const tree = await renderHook();
    await flush();

    expect(latest().source).toBe(CompassLocationSource.NONE);
    expect(mockGetForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it("hydrates a valid saved fix as source saved without a silent fetch replacing it", async () => {
    const savedFix = {
      latitude: precisePosition.coords.latitude,
      longitude: precisePosition.coords.longitude,
      accuracyMeters: precisePosition.coords.accuracy,
      altitude: precisePosition.coords.altitude,
      timestamp: Date.now(),
    };
    useCompassStore.setState({ lastVerifiedFix: savedFix });
    mockGetForegroundPermissionsAsync.mockResolvedValue(deniedPermission);

    const tree = await renderHook();
    await flush();

    const result = latest();
    const persistedFix = useCompassStore.getState().lastVerifiedFix;
    act(() => tree.unmount());

    expect(result.fix).toEqual(savedFix);
    expect(result.source).toBe(CompassLocationSource.SAVED);
    expect(persistedFix).toEqual(savedFix);
    expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockWatchPositionAsync).not.toHaveBeenCalled();
  });

  it("prompts for permission on refresh when undetermined and saves one high-accuracy fix", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue(undeterminedPermission);
    mockRequestForegroundPermissionsAsync.mockResolvedValue(grantedPermission);
    mockHasServicesEnabledAsync.mockResolvedValue(true);
    useSuccessfulPosition();
    const tree = await renderHook();
    await flush();

    expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
    await act(async () => latest().refresh());
    await flush();

    expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockWatchPositionAsync.mock.calls[0][0]).toEqual({
      accuracy: 4,
      mayShowUserSettingsDialog: true,
    });
    expect(latest().source).toBe(CompassLocationSource.FRESH);
    expect(latest().fix).toMatchObject({
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 8,
    });
    expect(useCompassStore.getState().lastVerifiedFix).toMatchObject({ accuracyMeters: 8 });
    act(() => tree.unmount());
  });

  it("acquires a location fix only while the compass feature is active", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission);
    mockHasServicesEnabledAsync.mockResolvedValue(true);
    useSuccessfulPosition();

    const tree = await renderHook(false);
    await flush();

    expect(mockGetForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockWatchPositionAsync).not.toHaveBeenCalled();

    await act(async () => tree.update(<Probe active />));
    await flush();

    expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockWatchPositionAsync).toHaveBeenCalledTimes(1);
    expect(latest().source).toBe(CompassLocationSource.FRESH);

    await act(async () => tree.update(<Probe active={false} />));
    await act(async () => tree.update(<Probe active />));
    await flush();

    expect(mockWatchPositionAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it("falls back to a still-reliable saved fix while exposing the fresh failure", async () => {
    const savedFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 12,
      altitude: 610,
      timestamp: Date.now() - 60_000,
    };
    useCompassStore.setState({ lastVerifiedFix: savedFix });
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission);
    mockHasServicesEnabledAsync.mockResolvedValue(true);
    mockWatchPositionAsync.mockRejectedValue(new Error("Location request timed out"));

    const tree = await renderHook();
    await flush();

    expect(latest().source).toBe(CompassLocationSource.SAVED);
    expect(latest().fix).toEqual(savedFix);
    expect(latest().issue).toBe(CompassReliabilityIssue.LOCATION_TIMEOUT);
    act(() => tree.unmount());
  });

  it("requires settings when the location provider fails with a saved fallback", async () => {
    const savedFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 12,
      altitude: 610,
      timestamp: Date.now() - 60_000,
    };
    useCompassStore.setState({ lastVerifiedFix: savedFix });
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission);
    mockHasServicesEnabledAsync.mockResolvedValue(true);
    mockWatchPositionAsync.mockRejectedValue(new Error("Location provider is disabled"));

    const tree = await renderHook();
    await flush();

    expect(latest().source).toBe(CompassLocationSource.SAVED);
    expect(latest().fix).toEqual(savedFix);
    expect(latest().issue).toBe(CompassReliabilityIssue.LOCATION_SERVICES_DISABLED);
    expect(latest().needsSettings).toBe(true);
    act(() => tree.unmount());
  });

  it("withholds location and requires settings for reduced accuracy permission", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      ...grantedPermission,
      ios: { scope: "whenInUse", accuracy: "reduced" },
    });

    const tree = await renderHook();
    await flush();

    expect(latest().source).toBe(CompassLocationSource.NONE);
    expect(latest().fix).toBeNull();
    expect(latest().issue).toBe(CompassReliabilityIssue.LOCATION_REDUCED_ACCURACY);
    expect(latest().needsSettings).toBe(true);
    expect(mockWatchPositionAsync).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it("rejects an inaccurate fresh result instead of persisting or displaying it", async () => {
    jest.useFakeTimers();
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission);
    mockHasServicesEnabledAsync.mockResolvedValue(true);
    useSuccessfulPosition({
      ...precisePosition,
      coords: { ...precisePosition.coords, accuracy: 250 },
    });

    const tree = await renderHook();
    await flush();
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest().source).toBe(CompassLocationSource.NONE);
    expect(latest().issue).toBe(CompassReliabilityIssue.LOCATION_TOO_INACCURATE);
    expect(useCompassStore.getState().lastVerifiedFix).toBeNull();
    act(() => tree.unmount());
  });

  it("downgrades a fresh fix and removes it when the saved fallback expires", async () => {
    const now = 1_750_000_000_000;
    jest.useFakeTimers();
    jest.setSystemTime(now);
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission);
    mockHasServicesEnabledAsync.mockResolvedValue(true);
    useSuccessfulPosition({ ...precisePosition, timestamp: now });

    const tree = await renderHook();
    await flush();
    expect(latest().source).toBe(CompassLocationSource.FRESH);

    await act(async () => {
      jest.advanceTimersByTime(MAX_FRESH_LOCATION_AGE_MS + 1);
      await Promise.resolve();
    });
    expect(latest().source).toBe(CompassLocationSource.SAVED);
    expect(latest().fix).not.toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(MAX_SAVED_LOCATION_AGE_MS - MAX_FRESH_LOCATION_AGE_MS);
      await Promise.resolve();
    });
    expect(latest().source).toBe(CompassLocationSource.NONE);
    expect(latest().fix).toBeNull();
    expect(latest().issue).toBe(CompassReliabilityIssue.LOCATION_STALE);
    expect(useCompassStore.getState().lastVerifiedFix).toBeNull();
    act(() => tree.unmount());
  });

  it("stops the native location watch when the foreground fix times out", async () => {
    jest.useFakeTimers();
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission);
    mockHasServicesEnabledAsync.mockResolvedValue(true);
    mockWatchPositionAsync.mockResolvedValue({ remove: mockRemoveLocationWatch });

    const tree = await renderHook();
    await flush();
    expect(mockWatchPositionAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRemoveLocationWatch).toHaveBeenCalledTimes(1);
    expect(latest().issue).toBe(CompassReliabilityIssue.LOCATION_TIMEOUT);
    act(() => tree.unmount());
  });

  it("cancels an in-flight location fetch when the compass feature becomes inactive", async () => {
    let locationCallback!: (position: typeof precisePosition) => void;
    let resolveSubscription!: (subscription: { remove: typeof mockRemoveLocationWatch }) => void;
    const subscriptionPromise = new Promise<{ remove: typeof mockRemoveLocationWatch }>(
      (resolve) => {
        resolveSubscription = resolve;
      }
    );
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedPermission);
    mockHasServicesEnabledAsync.mockResolvedValue(true);
    mockWatchPositionAsync.mockImplementation(
      (_options: unknown, callback: (position: typeof precisePosition) => void) => {
        locationCallback = callback;
        return subscriptionPromise;
      }
    );

    const tree = await renderHook();
    await flush();
    expect(mockWatchPositionAsync).toHaveBeenCalledTimes(1);

    await act(async () => tree.update(<Probe active={false} />));
    expect(mockRemoveLocationWatch).not.toHaveBeenCalled();
    resolveSubscription({ remove: mockRemoveLocationWatch });
    await flush();
    expect(mockRemoveLocationWatch).toHaveBeenCalledTimes(1);

    locationCallback(precisePosition);
    await flush();

    expect(latest().source).toBe(CompassLocationSource.NONE);
    expect(latest().fix).toBeNull();
    expect(useCompassStore.getState().lastVerifiedFix).toBeNull();
    act(() => tree.unmount());
  });

  it("does not start location acquisition when deactivated during a refresh's permission prompt", async () => {
    let resolvePermission!: (permission: typeof grantedPermission) => void;
    const permissionPromise = new Promise<typeof grantedPermission>((resolve) => {
      resolvePermission = resolve;
    });
    mockGetForegroundPermissionsAsync.mockResolvedValue(undeterminedPermission);
    mockRequestForegroundPermissionsAsync.mockReturnValue(permissionPromise);
    const tree = await renderHook();
    await flush();

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = latest().refresh();
    });
    await flush();
    expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);

    await act(async () => tree.update(<Probe active={false} />));
    resolvePermission(grantedPermission);
    await act(async () => refreshPromise);

    expect(mockHasServicesEnabledAsync).not.toHaveBeenCalled();
    expect(mockWatchPositionAsync).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
});
