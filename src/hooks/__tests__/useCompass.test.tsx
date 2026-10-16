import { act, renderHook } from "@testing-library/react-native";

import type { OrientationData } from "expo-orientation";

import { useCompass } from "@/hooks/useCompass";
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

type CompassProps = {
  location?: CompassLocationFix | null;
  locationFromProvider?: boolean;
  paused?: boolean;
};

const renderCompass = (props: CompassProps = {}) =>
  renderHook(
    ({ location = null, locationFromProvider = true, paused = false }: CompassProps) =>
      useCompass({ location, locationFromProvider, paused }),
    { initialProps: props }
  );

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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ["stale", now - MAX_HEADING_AGE_MS - 1, "stale_heading"],
    ["future-dated", now + MAX_HEADING_FUTURE_SKEW_MS + 1, "invalid_timestamp"],
  ])("withholds an already %s native sample", async (_name, timestamp, error) => {
    const { result } = await renderCompass();

    await act(() => mockHeadingListener?.(reliableEvent(timestamp)));

    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toBe(error);
  });

  it("expires a fresh sample based on its native timestamp", async () => {
    const { result } = await renderCompass();

    await act(() => mockHeadingListener?.(reliableEvent(now - 1_000)));
    expect(result.current.isValid).toBe(true);

    await act(() => jest.advanceTimersByTime(MAX_HEADING_AGE_MS - 1_000 + 1));

    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toBe("stale_heading");
  });

  it("passes a finite tilt through", async () => {
    const { result } = await renderCompass();

    await act(() => mockHeadingListener?.({ ...reliableEvent(now), tiltDegrees: 32.5 }));

    expect(result.current.tiltDegrees).toBe(32.5);
  });

  it("normalizes missing or invalid tilt to null", async () => {
    const { result } = await renderCompass();

    await act(() => mockHeadingListener?.(reliableEvent(now)));
    expect(result.current.tiltDegrees).toBeNull();

    await act(() => mockHeadingListener?.({ ...reliableEvent(now), tiltDegrees: Number.NaN }));
    expect(result.current.tiltDegrees).toBeNull();

    await act(() => mockHeadingListener?.({ ...reliableEvent(now), tiltDegrees: -3 }));
    expect(result.current.tiltDegrees).toBeNull();
  });

  it("keeps the sensor running through fixes that cannot change declination", async () => {
    const fix: CompassLocationFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 18,
      altitude: 612,
      timestamp: now,
    };
    const { rerender } = await renderCompass({ location: fix });
    expect(mockStartWatching).toHaveBeenCalledTimes(1);

    const drifted: CompassLocationFix = {
      ...fix,
      latitude: fix.latitude + DECLINATION_DRIFT_DEGREES / 2,
      longitude: fix.longitude + DECLINATION_DRIFT_DEGREES / 2,
      altitude: 615,
      timestamp: now + 30_000,
    };
    await rerender({ location: drifted });

    expect(mockStopWatching).not.toHaveBeenCalled();
    expect(mockStartWatching).toHaveBeenCalledTimes(1);
  });

  it("restarts the sensor once the position can carry a different declination", async () => {
    const fix: CompassLocationFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 18,
      altitude: 612,
      timestamp: now,
    };
    const { rerender } = await renderCompass({ location: fix });
    expect(mockStartWatching).toHaveBeenCalledTimes(1);

    const moved: CompassLocationFix = {
      ...fix,
      latitude: fix.latitude + DECLINATION_DRIFT_DEGREES * 2,
      timestamp: now + 30_000,
    };
    await rerender({ location: moved });

    expect(mockStopWatching).toHaveBeenCalledTimes(1);
    expect(mockStartWatching).toHaveBeenCalledTimes(2);
    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: moved.latitude, locationTimestamp: moved.timestamp })
    );
  });

  it("hands the newest fix to a session that outlived it", async () => {
    const fix: CompassLocationFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 18,
      altitude: 612,
      timestamp: now,
    };
    const { rerender } = await renderCompass({ location: fix });

    // A drifting fix leaves the session alone, so the far move that follows must start
    // from the newest position rather than the one the previous session was anchored to.
    await rerender({ location: { ...fix, latitude: 24.72, timestamp: now + 10_000 } });
    await rerender({ location: { ...fix, latitude: 25.5, timestamp: now + 20_000 } });

    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: 25.5, locationTimestamp: now + 20_000 })
    );
  });

  const staleFix: CompassLocationFix = {
    latitude: 24.7136,
    longitude: 46.6753,
    accuracyMeters: 18,
    altitude: 612,
    timestamp: 1_750_000_000_000 - MAX_FRESH_LOCATION_AGE_MS - 1,
  };

  it("restarts once so a fresh fix can reach the fused provider", async () => {
    const { rerender } = await renderCompass({ location: staleFix });
    expect(mockStartWatching).toHaveBeenCalledTimes(1);

    // Same place, so only the fix becoming fresh can justify the restart.
    await rerender({ location: { ...staleFix, timestamp: now } });

    expect(mockStartWatching).toHaveBeenCalledTimes(2);
    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.objectContaining({ locationTimestamp: now })
    );
  });

  it("retries again after a resume that restarted on a fix gone stale", async () => {
    const { rerender } = await renderCompass({ location: staleFix });
    await rerender({ location: { ...staleFix, timestamp: now } });
    expect(mockStartWatching).toHaveBeenCalledTimes(2);

    // Backgrounded long enough for the unlocking fix to age out, then resumed.
    const aged = { ...staleFix, timestamp: now };
    await rerender({ location: aged, paused: true });
    await act(() => jest.advanceTimersByTime(MAX_FRESH_LOCATION_AGE_MS + 1));
    await rerender({ location: aged });

    const afterResume = mockStartWatching.mock.calls.length;
    await rerender({ location: { ...staleFix, timestamp: Date.now() } });

    expect(mockStartWatching.mock.calls.length).toBe(afterResume + 1);
    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.objectContaining({ locationTimestamp: Date.now() })
    );
  });

  it("never sends a chosen city's pick time as a fix time", async () => {
    const city: CompassLocationFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: MANUAL_LOCATION_ACCURACY_METERS,
      altitude: null,
      timestamp: now,
    };
    const { rerender } = await renderCompass({ location: city, locationFromProvider: false });

    expect(mockStartWatching).toHaveBeenCalledTimes(1);
    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ locationTimestamp: expect.anything() })
    );

    await rerender({ location: { ...city, timestamp: now + 1_000 }, locationFromProvider: false });

    expect(mockStopWatching).not.toHaveBeenCalled();
    expect(mockStartWatching).toHaveBeenCalledTimes(1);
  });

  it("holds the session when the fix that reached the fused provider ages out", async () => {
    const fix: CompassLocationFix = { ...staleFix, timestamp: now };
    const { rerender } = await renderCompass({ location: fix });
    expect(mockStartWatching).toHaveBeenCalledTimes(1);

    await act(() => jest.advanceTimersByTime(MAX_FRESH_LOCATION_AGE_MS + 1));
    await rerender({ location: { ...fix, timestamp: now + 1_000 } });

    expect(mockStopWatching).not.toHaveBeenCalled();
    expect(mockStartWatching).toHaveBeenCalledTimes(1);
  });

  it("keeps a non-finite fix from stranding the session without a reference", async () => {
    const { rerender } = await renderCompass({
      location: { ...staleFix, latitude: Number.NaN, timestamp: now },
    });
    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ latitude: expect.anything() })
    );

    await rerender({ location: { ...staleFix, timestamp: now } });

    expect(mockStartWatching).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: staleFix.latitude })
    );
  });

  it("withholds the previous mode's sample while the native sensor restarts", async () => {
    const fix: CompassLocationFix = {
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 8,
      altitude: 612,
      timestamp: now,
    };
    const { result, rerender } = await renderCompass({ location: fix });

    await act(() => mockHeadingListener?.(reliableEvent(now)));
    expect(result.current.isValid).toBe(true);

    await rerender({ location: null });

    expect(result.current.isActive).toBe(false);
    expect(result.current.isValid).toBe(false);
  });
});
