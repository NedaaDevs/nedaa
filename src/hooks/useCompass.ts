import { useState, useEffect } from "react";
import { Magnetometer } from "expo-sensors";
import type { EventSubscription } from "expo-notifications";

export type CompassData = {
  heading: number;
  accuracy: number;
  isAvailable: boolean;
  isActive: boolean;
};

export const useCompass = () => {
  const [compassData, setCompassData] = useState<CompassData>({
    heading: 0,
    accuracy: 0,
    isAvailable: false,
    isActive: false,
  });

  const [subscription, setSubscription] = useState<EventSubscription | null>(null);

  // Calculate heading from magnetometer data
  const calculateHeading = (x: number, y: number, _: number): number => {
    // Calculate heading (0-360 degrees)
    const heading = Math.atan2(y, x) * (180 / Math.PI);

    return (270 + heading + 360) % 360;
  };

  // Calculate accuracy based on magnetic field strength
  const calculateAccuracy = (x: number, y: number, z: number): number => {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    // Typical Earth's magnetic field is around 25-65 microteslas
    // Higher accuracy when closer to expected range
    const expectedRange = 50;
    const accuracy = Math.max(0, 100 - Math.abs(magnitude - expectedRange) * 2);
    return Math.min(100, accuracy);
  };

  // Smooth heading to reduce jitter
  const smoothHeading = (newHeading: number, lastHeading: number): number => {
    // Handle 0/360 degree boundary
    let diff = newHeading - lastHeading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    if (Math.abs(diff) < 0.5) {
      return lastHeading; // No significant change
    }

    // Less alpha means smoother but slower response
    const alpha = 0.4;
    let smoothed = lastHeading + alpha * diff;

    // Normalize to 0-360
    if (smoothed < 0) smoothed += 360;
    if (smoothed >= 360) smoothed -= 360;

    return smoothed;
  };

  const startCompass = async () => {
    try {
      const isAvailable = await Magnetometer.isAvailableAsync();

      if (!isAvailable) {
        setCompassData((prev) => ({ ...prev, isAvailable: false }));
        return;
      }

      // Set update interval to 100ms for smooth compass movement
      Magnetometer.setUpdateInterval(100);
      let lastSmoothedHeading = 0;

      const newSubscription = Magnetometer.addListener(({ x, y, z }) => {
        const rawHeading = calculateHeading(x, y, z);
        const accuracy = calculateAccuracy(x, y, z);

        // Apply smoothing to reduce jitter
        const smoothedHeading = smoothHeading(rawHeading, lastSmoothedHeading);
        lastSmoothedHeading = smoothedHeading;

        setCompassData({
          heading: smoothedHeading,
          accuracy,
          isAvailable: true,
          isActive: true,
        });
      });

      setSubscription(newSubscription);
    } catch (error) {
      console.error("Error starting compass:", error);
      setCompassData((prev) => ({
        ...prev,
        isAvailable: false,
        isActive: false,
      }));
    }
  };

  const stopCompass = () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
      setCompassData((prev) => ({ ...prev, isActive: false }));
    }
  };

  // Auto-start compass when hook is mounted
  useEffect(() => {
    startCompass();

    return () => {
      stopCompass();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...compassData,
    startCompass,
    stopCompass,
  };
};
