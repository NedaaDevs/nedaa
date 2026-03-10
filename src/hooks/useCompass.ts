import { useState, useEffect } from "react";
import { ExpoOrientationModule } from "../../modules/expo-orientation/src";
import type { OrientationData } from "../../modules/expo-orientation/src";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("compass");

export type CompassSource =
  | "fop"
  | "rotation_vector"
  | "accelerometer_magnetometer"
  | "cl_location";

export type CompassData = {
  heading: number;
  accuracy: number;
  isAvailable: boolean;
  isActive: boolean;
  source: CompassSource;
};

export const useCompass = (paused = false): CompassData => {
  const [data, setData] = useState<CompassData>({
    heading: 0,
    accuracy: -1,
    isAvailable: true,
    isActive: false,
    source: "cl_location",
  });

  useEffect(() => {
    if (paused) {
      ExpoOrientationModule.stopWatching();
      setData((prev) => ({ ...prev, isActive: false }));
      return;
    }

    if (!ExpoOrientationModule.isAvailable) {
      log.w("Hook", "Native orientation module not available");
      setData((prev) => ({ ...prev, isAvailable: false }));
      return;
    }

    log.i("Hook", "Starting compass");
    let receivedEvent = false;
    const timeout = setTimeout(() => {
      if (!receivedEvent) {
        log.w("Hook", "No heading event received after 3s, marking unavailable");
        setData((prev) => ({ ...prev, isAvailable: false }));
      }
    }, 3000);

    try {
      const subscription = ExpoOrientationModule.addListener(
        "onHeadingUpdate",
        (event: OrientationData) => {
          const heading = typeof event?.heading === "number" ? event.heading : 0;
          const accuracy = typeof event?.accuracy === "number" ? event.accuracy : -1;
          const source = (event?.source as CompassSource) ?? "rotation_vector";

          if (!receivedEvent) {
            log.i("Hook", `First heading received: ${heading.toFixed(1)} (source: ${source})`);
          }
          receivedEvent = true;
          setData({
            heading,
            accuracy,
            isAvailable: true,
            isActive: true,
            source,
          });
        }
      );

      ExpoOrientationModule.startWatching();

      return () => {
        clearTimeout(timeout);
        subscription.remove();
        ExpoOrientationModule.stopWatching();
      };
    } catch (error) {
      log.e(
        "Hook",
        "Failed to start compass",
        error instanceof Error ? error : new Error(String(error))
      );
      clearTimeout(timeout);
      setData((prev) => ({ ...prev, isAvailable: false }));
    }
  }, [paused]);

  return data;
};
