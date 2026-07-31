import React, { act } from "react";
import renderer from "react-test-renderer";

import type { OrientationData } from "expo-orientation";

import { useCompass, type CompassData } from "@/hooks/useCompass";
import type { CompassLocationFix } from "@/types/compass";
import {
  DECLINATION_DRIFT_DEGREES,
  MANUAL_LOCATION_ACCURACY_METERS,
  MAX_FRESH_LOCATION_AGE_MS,
  MAX_HEADING_AGE_MS,
  MAX_HEADING_FUTURE_SKEW_MS,
} from "@/utils/compass";

const mockStartWatching = jest.fn();
const mockStopWatching = jest.fn();
const mockRemoveListener = jest.fn();
let mockHeadingListener: ((event: OrientationData) => void) | null = null;

jest.mock("expo-orientation", () => ({
  ExpoOrientationModule: {
    isAvailable: true,
    startWatching: (...args: unknown[]) => mockStartWatching(...args),
    stopWatching: (...args: unknown[]) => mockStopWatching(...args),
    addListener: (_eventName: string, listener: (event: OrientationData) => void) => {
      mockHeadingListener = listener;
      return { remove: mockRemoveListener };
    },
  },
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));

const results: CompassData[] = [];

const Probe = ({
  location = null,
  locationFromProvider = true,
  paused = false,
}: {
  location?: CompassLocationFix | null;
  locationFromProvider?: boolean;
  paused?: boolean;
}) => {
  results.push(useCompass({ location, locationFromProvider, paused }));
  return null;
};

const latest = () => results[results.length - 1];

const renderHook = async (location: CompassLocationFix | null = null) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Probe location={location} />);
    await Promise.resolve();
  });
  return tree;
};

const reliableEvent = (timestamp: number): OrientationData => ({
  heading: 127,
  accuracyDegrees: 5,
  northReference: "magnetic",
  isValid: true,
  timestamp,
  source: "rotation_vector",
});

describe("useCompass", () => {
  const now = 1_750_000_000_000;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    jest.clearAllMocks();
    mockHeadingListener = null;
    results.length = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ["stale", now - MAX_HEADING_AGE_MS - 1, "stale_heading"],
    ["future-dated", now + MAX_HEADING_FUTURE_SKEW_MS + 1, "invalid_timestamp"],
  ])("withholds an already %s native sample", async (_name, timestamp, error) => {
    const tree = await renderHook();

    act(() => mockHeadingListener?.(reliableEvent(timestamp)));

    expect(latest().isValid).toBe(false);
    expect(latest().error).toBe(error);
    act(() => tree.unmount());
  });

  it("expires a fresh sample based on its native timestamp", async () => {
    const tree = await renderHook();

    act(() => mockHeadingListener?.(reliableEvent(now - 1_000)));
    expect(latest().isValid).toBe(true);

    act(() => jest.advanceTimersByTime(MAX_HEADING_AGE_MS - 1_000 + 1));

    expect(latest().isValid).toBe(false);
    expect(latest().error).toBe("stale_heading");
    act(() => tree.unmount());
  });

  it("passes a finite tilt through", async () => {
    const tree = await renderHook();

    act(() => mockHeadingListener?.({ ...reliableEvent(now), tiltDegrees: 32.5 }));

    expect(latest().tiltDegrees).toBe(32.5);
    act(() => tree.unmount());
  });

  it("normalizes missing or invalid tilt to null", async () => {
    const tree = await renderHook();

    act(() => mockHeadingListener?.(reliableEvent(now)));
    expect(latest().tiltDegrees).toBeNull();

    act(() => mockHeadingListener?.({ ...reliableEvent(now), tiltDegrees: Number.NaN }));
    expect(latest().tiltDegrees).toBeNull();

    act(() => mockHeadingListener?.({ ...reliableEvent(now), tiltDegrees: -3 }));
    expect(latest().tiltDegrees).toBeNull();

    act(() => tree.unmount());
  });

  it("keeps the sensor running through fixes that cannot change declination", async () => {
    const fix: CompassLocationFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 18,
      altitude: 612,
      timestamp: now,
    };
    const tree = await renderHook(fix);
    expect(mockStartWatching).toHaveBeenCalledTimes(1);

    const drifted: CompassLocationFix = {
      ...fix,
      latitude: fix.latitude + DECLINATION_DRIFT_DEGREES / 2,
      longitude: fix.longitude + DECLINATION_DRIFT_DEGREES / 2,
      altitude: 615,
      timestamp: now + 30_000,
    };
    await act(async () => {
      tree.update(<Probe location={drifted} />);
      await Promise.resolve();
    });

    expect(mockStopWatching).not.toHaveBeenCalled();
    expect(mockStartWatching).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("restarts the sensor once the position can carry a different declination", async () => {
    const fix: CompassLocationFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 18,
      altitude: 612,
      timestamp: now,
    };
    const tree = await renderHook(fix);
    expect(mockStartWatching).toHaveBeenCalledTimes(1);

    const moved: CompassLocationFix = {
      ...fix,
      latitude: fix.latitude + DECLINATION_DRIFT_DEGREES * 2,
      timestamp: now + 30_000,
    };
    await act(async () => {
      tree.update(<Probe location={moved} />);
      await Promise.resolve();
    });

    expect(mockStopWatching).toHaveBeenCalledTimes(1);
    expect(mockStartWatching).toHaveBeenCalledTimes(2);
    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: moved.latitude, locationTimestamp: moved.timestamp })
    );
    act(() => tree.unmount());
  });

  it("hands the newest fix to a session that outlived it", async () => {
    const fix: CompassLocationFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 18,
      altitude: 612,
      timestamp: now,
    };
    const tree = await renderHook(fix);

    // A drifting fix leaves the session alone, so the far move that follows must start
    // from the newest position rather than the one the previous session was anchored to.
    await act(async () => {
      tree.update(<Probe location={{ ...fix, latitude: 24.72, timestamp: now + 10_000 }} />);
      await Promise.resolve();
    });
    await act(async () => {
      tree.update(<Probe location={{ ...fix, latitude: 25.5, timestamp: now + 20_000 }} />);
      await Promise.resolve();
    });

    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 25.5, locationTimestamp: now + 20_000 })
    );
    act(() => tree.unmount());
  });

  const staleFix: CompassLocationFix = {
    latitude: 24.7136,
    longitude: 46.6753,
    accuracyMeters: 18,
    altitude: 612,
    timestamp: 1_750_000_000_000 - MAX_FRESH_LOCATION_AGE_MS - 1,
  };

  it("restarts once so a fresh fix can reach the fused provider", async () => {
    const tree = await renderHook(staleFix);
    expect(mockStartWatching).toHaveBeenCalledTimes(1);

    // Same place, so only the fix becoming fresh can justify the restart.
    await act(async () => {
      tree.update(<Probe location={{ ...staleFix, timestamp: now }} />);
      await Promise.resolve();
    });

    expect(mockStartWatching).toHaveBeenCalledTimes(2);
    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.objectContaining({ locationTimestamp: now })
    );
    act(() => tree.unmount());
  });

  it("retries again after a resume that restarted on a fix gone stale", async () => {
    const tree = await renderHook(staleFix);
    await act(async () => {
      tree.update(<Probe location={{ ...staleFix, timestamp: now }} />);
      await Promise.resolve();
    });
    expect(mockStartWatching).toHaveBeenCalledTimes(2);

    // Backgrounded long enough for the unlocking fix to age out, then resumed.
    const aged = { ...staleFix, timestamp: now };
    await act(async () => {
      tree.update(<Probe location={aged} paused />);
      await Promise.resolve();
    });
    act(() => jest.advanceTimersByTime(MAX_FRESH_LOCATION_AGE_MS + 1));
    await act(async () => {
      tree.update(<Probe location={aged} />);
      await Promise.resolve();
    });

    const afterResume = mockStartWatching.mock.calls.length;
    await act(async () => {
      tree.update(<Probe location={{ ...staleFix, timestamp: Date.now() }} />);
      await Promise.resolve();
    });

    expect(mockStartWatching.mock.calls.length).toBe(afterResume + 1);
    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.objectContaining({ locationTimestamp: Date.now() })
    );
    act(() => tree.unmount());
  });

  it("never sends a chosen city's pick time as a fix time", async () => {
    const city: CompassLocationFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: MANUAL_LOCATION_ACCURACY_METERS,
      altitude: null,
      timestamp: now,
    };
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Probe location={city} locationFromProvider={false} />);
      await Promise.resolve();
    });

    expect(mockStartWatching).toHaveBeenCalledTimes(1);
    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ locationTimestamp: expect.anything() })
    );

    await act(async () => {
      tree.update(
        <Probe location={{ ...city, timestamp: now + 1_000 }} locationFromProvider={false} />
      );
      await Promise.resolve();
    });

    expect(mockStopWatching).not.toHaveBeenCalled();
    expect(mockStartWatching).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("holds the session when the fix that reached the fused provider ages out", async () => {
    const fix: CompassLocationFix = { ...staleFix, timestamp: now };
    const tree = await renderHook(fix);
    expect(mockStartWatching).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(MAX_FRESH_LOCATION_AGE_MS + 1));
    await act(async () => {
      tree.update(<Probe location={{ ...fix, timestamp: now + 1_000 }} />);
      await Promise.resolve();
    });

    expect(mockStopWatching).not.toHaveBeenCalled();
    expect(mockStartWatching).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("keeps a non-finite fix from stranding the session without a reference", async () => {
    const tree = await renderHook({ ...staleFix, latitude: Number.NaN, timestamp: now });
    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ latitude: expect.anything() })
    );

    await act(async () => {
      tree.update(<Probe location={{ ...staleFix, timestamp: now }} />);
      await Promise.resolve();
    });

    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: staleFix.latitude })
    );
    act(() => tree.unmount());
  });

  it("withholds the previous mode's sample while the native sensor restarts", async () => {
    const fix: CompassLocationFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 8,
      altitude: 612,
      timestamp: now,
    };
    const tree = await renderHook(fix);

    act(() => mockHeadingListener?.(reliableEvent(now)));
    expect(latest().isValid).toBe(true);

    act(() => tree.update(<Probe location={null} />));

    expect(latest().isActive).toBe(false);
    expect(latest().isValid).toBe(false);
    act(() => tree.unmount());
  });
});
