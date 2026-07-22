import { useEffect, useState } from "react";
import type {
  OrientationData,
  OrientationNorthReference,
  OrientationSource,
} from "expo-orientation";
import { ExpoOrientationModule } from "expo-orientation";

import type { CompassLocationFix } from "@/types/compass";
import { AppLogger } from "@/utils/appLogger";
import { MAX_HEADING_AGE_MS, MAX_HEADING_FUTURE_SKEW_MS, angleDifference } from "@/utils/compass";

const log = AppLogger.create("compass");
const STARTUP_TIMEOUT_MS = 4_000;
const DEBUG_SAMPLE_INTERVAL_MS = 1_000;
// The fused provider can deliver samples faster than 50Hz; publishing every one re-renders the
// whole screen per sample. Only meaningful changes (or a heartbeat) reach React state.
const HEADING_PUBLISH_EPSILON_DEGREES = 0.2;
const PUBLISH_HEARTBEAT_MS = 1_000;

const orientationSources = new Set<OrientationSource>([
  "fop",
  "rotation_vector",
  "accelerometer_magnetometer",
  "cl_location",
  "unknown",
]);

const northReferences = new Set<OrientationNorthReference>(["true", "magnetic", "unknown"]);

export type CompassData = {
  heading: number;
  accuracyDegrees: number | null;
  tiltDegrees: number | null;
  northReference: OrientationNorthReference;
  isAvailable: boolean;
  isActive: boolean;
  isValid: boolean;
  timestamp: number;
  observedAt: number;
  source: OrientationSource;
  error: string | null;
};

type UseCompassOptions = {
  paused?: boolean;
  location?: CompassLocationFix | null;
  restartKey?: number;
};

const initialData: CompassData = {
  heading: 0,
  accuracyDegrees: null,
  tiltDegrees: null,
  northReference: "unknown",
  isAvailable: ExpoOrientationModule.isAvailable,
  isActive: false,
  isValid: false,
  timestamp: 0,
  observedAt: 0,
  source: "unknown",
  error: null,
};

type CompassState = CompassData & {
  sessionKey: string;
};

export const useCompass = ({
  paused = false,
  location = null,
  restartKey = 0,
}: UseCompassOptions = {}): CompassData => {
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const altitude = location?.altitude;
  const locationTimestamp = location?.timestamp;
  const sessionKey = [
    paused ? "paused" : "active",
    latitude ?? "no-latitude",
    longitude ?? "no-longitude",
    altitude ?? "no-altitude",
    locationTimestamp ?? "no-location-time",
    restartKey,
  ].join(":");
  const [data, setData] = useState<CompassState>({ ...initialData, sessionKey: "" });

  useEffect(() => {
    if (paused) {
      ExpoOrientationModule.stopWatching();
      // Mirror the native stop immediately so stale samples cannot remain displayable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData((previous) => ({
        ...previous,
        isActive: false,
        isValid: false,
        timestamp: 0,
        observedAt: 0,
        sessionKey,
      }));
      return;
    }

    if (!ExpoOrientationModule.isAvailable) {
      log.w("Sensor", "native orientation module is unavailable");
      setData({
        ...initialData,
        isAvailable: false,
        error: "module_unavailable",
        sessionKey,
      });
      return;
    }

    const hasLocation =
      typeof latitude === "number" &&
      Number.isFinite(latitude) &&
      typeof longitude === "number" &&
      Number.isFinite(longitude);

    log.i("Session", `starting sensor; locationReference=${hasLocation ? "provided" : "none"}`);

    let receivedEvent = false;
    let lastSource: OrientationSource = "unknown";
    let lastValidity: string | null = null;
    let lastDebugAt = 0;
    let staleTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastPublished: {
      heading: number;
      accuracyDegrees: number | null;
      tiltDegrees: number | null;
      northReference: OrientationNorthReference;
      source: OrientationSource;
      isValid: boolean;
      error: string | null;
    } | null = null;
    let lastPublishedAt = 0;

    const timeout = setTimeout(() => {
      if (receivedEvent) return;
      log.w("Sensor", `no native event within ${STARTUP_TIMEOUT_MS}ms`);
      setData((previous) => ({
        ...previous,
        isAvailable: false,
        isActive: false,
        isValid: false,
        error: "startup_timeout",
        sessionKey,
      }));
    }, STARTUP_TIMEOUT_MS);

    try {
      const subscription = ExpoOrientationModule.addListener(
        "onHeadingUpdate",
        (event: OrientationData) => {
          if (!receivedEvent) {
            receivedEvent = true;
            clearTimeout(timeout);
          }

          const source = orientationSources.has(event?.source) ? event.source : "unknown";
          const northReference = northReferences.has(event?.northReference)
            ? event.northReference
            : "unknown";
          const headingIsValid =
            typeof event?.heading === "number" &&
            Number.isFinite(event.heading) &&
            event.heading >= 0 &&
            event.heading < 360;
          const accuracyDegrees =
            typeof event?.accuracyDegrees === "number" &&
            Number.isFinite(event.accuracyDegrees) &&
            event.accuracyDegrees >= 0
              ? event.accuracyDegrees
              : null;
          const tiltDegrees =
            typeof event?.tiltDegrees === "number" &&
            Number.isFinite(event.tiltDegrees) &&
            event.tiltDegrees >= 0 &&
            event.tiltDegrees <= 180
              ? event.tiltDegrees
              : null;
          const timestamp =
            typeof event?.timestamp === "number" && Number.isFinite(event.timestamp)
              ? event.timestamp
              : 0;
          const now = Date.now();
          const sampleAge = timestamp > 0 ? now - timestamp : Number.POSITIVE_INFINITY;
          const timestampIsValid =
            timestamp > 0 &&
            sampleAge <= MAX_HEADING_AGE_MS &&
            sampleAge >= -MAX_HEADING_FUTURE_SKEW_MS;
          const isValid = event?.isValid === true && headingIsValid && timestampIsValid;
          const error =
            typeof event?.error === "string"
              ? event.error
              : !headingIsValid
                ? "invalid_heading"
                : sampleAge > MAX_HEADING_AGE_MS
                  ? "stale_heading"
                  : !timestampIsValid
                    ? "invalid_timestamp"
                    : null;

          if (staleTimeout) clearTimeout(staleTimeout);
          if (isValid) {
            staleTimeout = setTimeout(
              () => {
                log.w("Reading", `no fresh heading within ${MAX_HEADING_AGE_MS}ms`);
                setData((previous) =>
                  previous.sessionKey === sessionKey
                    ? {
                        ...previous,
                        isValid: false,
                        observedAt: Date.now(),
                        error: "stale_heading",
                      }
                    : previous
                );
              },
              MAX_HEADING_AGE_MS - sampleAge + 1
            );
          }

          if (source !== lastSource) {
            log.i(
              "Sensor",
              `source=${source}; northReference=${northReference}; accuracy=${accuracyDegrees ?? "unknown"}`
            );
            lastSource = source;
          }

          const validity = `${isValid}:${northReference}:${error ?? "none"}`;
          if (validity !== lastValidity) {
            if (isValid) {
              log.i(
                "Reading",
                `accepted; source=${source}; northReference=${northReference}; accuracy=${accuracyDegrees ?? "unknown"}`
              );
            } else {
              log.w(
                "Reading",
                `withheld; source=${source}; northReference=${northReference}; error=${error ?? "invalid"}`
              );
            }
            lastValidity = validity;
          }

          if (now - lastDebugAt >= DEBUG_SAMPLE_INTERVAL_MS) {
            log.d(
              "Sample",
              `heading=${headingIsValid ? event.heading.toFixed(1) : "invalid"}; accuracy=${accuracyDegrees ?? "unknown"}; age=${timestamp > 0 ? Math.max(0, now - timestamp) : "unknown"}ms`
            );
            lastDebugAt = now;
          }

          const heading = headingIsValid ? event.heading : 0;
          const nullabilityChanged = (a: number | null, b: number | null) =>
            (a === null) !== (b === null) ||
            (a !== null && b !== null && Math.round(a) !== Math.round(b));
          const significant =
            lastPublished === null ||
            lastPublished.isValid !== isValid ||
            lastPublished.error !== error ||
            lastPublished.northReference !== northReference ||
            lastPublished.source !== source ||
            nullabilityChanged(lastPublished.accuracyDegrees, accuracyDegrees) ||
            nullabilityChanged(lastPublished.tiltDegrees, tiltDegrees) ||
            Math.abs(angleDifference(lastPublished.heading, heading)) >=
              HEADING_PUBLISH_EPSILON_DEGREES ||
            now - lastPublishedAt >= PUBLISH_HEARTBEAT_MS;
          if (!significant) return;

          lastPublished = {
            heading,
            accuracyDegrees,
            tiltDegrees,
            northReference,
            source,
            isValid,
            error,
          };
          lastPublishedAt = now;

          setData({
            heading,
            accuracyDegrees,
            tiltDegrees,
            northReference,
            isAvailable: error !== "sensor_unavailable" && error !== "module_unavailable",
            isActive: true,
            isValid,
            timestamp,
            observedAt: now,
            source,
            error,
            sessionKey,
          });
        }
      );

      const startupInfo = ExpoOrientationModule.startWatching({
        ...(hasLocation ? { latitude, longitude } : {}),
        ...(typeof altitude === "number" && Number.isFinite(altitude) ? { altitude } : {}),
        ...(typeof locationTimestamp === "number" && Number.isFinite(locationTimestamp)
          ? { locationTimestamp }
          : {}),
      });
      if (startupInfo) {
        log.i("Session", `native start: ${startupInfo}`);
      }

      return () => {
        clearTimeout(timeout);
        if (staleTimeout) clearTimeout(staleTimeout);
        subscription.remove();
        ExpoOrientationModule.stopWatching();
        log.i("Session", "stopped sensor");
      };
    } catch (error) {
      clearTimeout(timeout);
      const cause = error instanceof Error ? error : new Error(String(error));
      log.e("Session", "failed to start sensor", cause);
      setData({
        ...initialData,
        isAvailable: false,
        error: "startup_failed",
        sessionKey,
      });
    }
  }, [paused, latitude, longitude, altitude, locationTimestamp, restartKey, sessionKey]);

  const { sessionKey: dataSessionKey, ...compassData } = data;
  if (dataSessionKey !== sessionKey) {
    return {
      ...compassData,
      isActive: false,
      isValid: false,
      timestamp: 0,
      observedAt: 0,
      error: null,
    };
  }

  return compassData;
};
