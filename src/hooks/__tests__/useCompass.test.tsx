import React from "react";
import renderer, { act } from "react-test-renderer";

import type { OrientationData } from "expo-orientation";

import { useCompass, type CompassData } from "@/hooks/useCompass";
import type { CompassLocationFix } from "@/types/compass";
import { MAX_HEADING_AGE_MS, MAX_HEADING_FUTURE_SKEW_MS } from "@/utils/compass";

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

const Probe = ({ location = null }: { location?: CompassLocationFix | null }) => {
  results.push(useCompass({ location }));
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
