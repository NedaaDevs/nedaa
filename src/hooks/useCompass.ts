import { useState, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import { useLocationStore } from "@/stores/location";

export type CompassData = {
  heading: number;
  accuracy: number;
  isAvailable: boolean;
  isActive: boolean;
  source: "fused" | "magnetometer";
};

const calculateHeading = (x: number, y: number): number => {
  const heading = Math.atan2(y, x) * (180 / Math.PI);
  return (270 + heading + 360) % 360;
};

const calculateAccuracy = (x: number, y: number, z: number): number => {
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  const expectedRange = 50;
  const accuracy = Math.max(0, 100 - Math.abs(magnitude - expectedRange) * 2);
  return Math.min(100, accuracy);
};

const smoothHeading = (newHeading: number, lastHeading: number): number => {
  let diff = newHeading - lastHeading;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  if (Math.abs(diff) < 0.5) return lastHeading;
  const alpha = 0.4;
  let smoothed = lastHeading + alpha * diff;
  if (smoothed < 0) smoothed += 360;
  if (smoothed >= 360) smoothed -= 360;
  return smoothed;
};

export const useCompass = (paused = false) => {
  const [compassData, setCompassData] = useState<CompassData>({
    heading: 0,
    accuracy: 0,
    isAvailable: false,
    isActive: false,
    source: "magnetometer",
  });

  const isLocationPermissionGranted = useLocationStore((s) => s.isLocationPermissionGranted);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const lastSmoothedHeadingRef = useRef(0);

  useEffect(() => {
    if (paused) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      setCompassData((prev) => ({ ...prev, isActive: false }));
      return;
    }

    let cancelled = false;

    const startFusedHeading = async () => {
      try {
        const sub = await Location.watchHeadingAsync((headingData) => {
          if (cancelled) return;
          const heading =
            headingData.trueHeading >= 0 ? headingData.trueHeading : headingData.magHeading;

          // expo-location returns 0-3 on both platforms (0=unreliable, 3=high)
          const level = headingData.accuracy ?? 0;
          const accuracy = [0, 33, 67, 100][Math.min(3, Math.max(0, level))] ?? 0;

          setCompassData({
            heading,
            accuracy,
            isAvailable: true,
            isActive: true,
            source: "fused",
          });
        });
        if (!cancelled) {
          subscriptionRef.current = sub;
        } else {
          sub.remove();
        }
      } catch {
        if (!cancelled) startMagnetometer();
      }
    };

    const startMagnetometer = async () => {
      try {
        const isAvailable = await Magnetometer.isAvailableAsync();
        if (!isAvailable || cancelled) {
          if (!cancelled) setCompassData((prev) => ({ ...prev, isAvailable: false }));
          return;
        }

        Magnetometer.setUpdateInterval(100);

        const sub = Magnetometer.addListener(({ x, y, z }) => {
          if (cancelled) return;
          const rawHeading = calculateHeading(x, y);
          const accuracy = calculateAccuracy(x, y, z);
          const smoothedHeading = smoothHeading(rawHeading, lastSmoothedHeadingRef.current);
          lastSmoothedHeadingRef.current = smoothedHeading;

          setCompassData({
            heading: smoothedHeading,
            accuracy,
            isAvailable: true,
            isActive: true,
            source: "magnetometer",
          });
        });
        if (!cancelled) {
          subscriptionRef.current = sub;
        } else {
          sub.remove();
        }
      } catch {
        if (!cancelled)
          setCompassData((prev) => ({ ...prev, isAvailable: false, isActive: false }));
      }
    };

    if (isLocationPermissionGranted) {
      startFusedHeading();
    } else {
      startMagnetometer();
    }

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [isLocationPermissionGranted, paused]);

  return compassData;
};
