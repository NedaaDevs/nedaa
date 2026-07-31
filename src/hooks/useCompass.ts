import { useEffect, useRef, useState } from "react";
import type {
  OrientationData,
  OrientationNorthReference,
  OrientationSource,
} from "expo-orientation";
import { ExpoOrientationModule } from "expo-orientation";

import { type CompassNorthReferenceValue } from "@/enums/compass";
import type { CompassLocationFix } from "@/types/compass";
import { AppLogger } from "@/utils/appLogger";
import {
  DECLINATION_DRIFT_DEGREES,
  MAX_FRESH_LOCATION_AGE_MS,
  MAX_HEADING_AGE_MS,
  MAX_HEADING_FUTURE_SKEW_MS,
  angleDifference,
  applyDeclinationCorrection,
} from "@/utils/compass";
import { getMagneticDeclination } from "@/utils/wmm";

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
  northReference: CompassNorthReferenceValue;
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
  /**
   * Whether the fix came from the platform's location provider. A chosen city is stamped with
   * when it was picked, which says nothing about the provider holding a location of its own.
   */
  locationFromProvider?: boolean;
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
  locationFromProvider = false,
  restartKey = 0,
}: UseCompassOptions = {}): CompassData => {
  const anchorRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const fixRef = useRef(location);
  // Set by the session effect: whether native would have rejected the starting fix as stale.
  const startedStaleRef = useRef(false);
  const retriedForRef = useRef<number | null>(null);
  const [fusedRetry, setFusedRetry] = useState(0);

  /* eslint-disable react-hooks/refs -- the anchor is hysteresis over its own previous value,
     mutated in place during render so the session key settles without an extra effect tick */
  // Restarting the sensor discards the platform's heading calibration, so the session keeps
  // an anchor position and re-anchors only when declination could have changed.
  const hasCoordinates =
    location !== null && Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
  const anchor = anchorRef.current;
  if (!hasCoordinates) {
    anchorRef.current = null;
  } else if (
    anchor === null ||
    Math.abs(location.latitude - anchor.latitude) > DECLINATION_DRIFT_DEGREES ||
    Math.abs(location.longitude - anchor.longitude) > DECLINATION_DRIFT_DEGREES
  ) {
    anchorRef.current = { latitude: location.latitude, longitude: location.longitude };
  }

  // Read at start, so the session key can ignore a fix without the effect going stale.
  fixRef.current = location;

  const anchorKey = anchorRef.current
    ? `${anchorRef.current.latitude}:${anchorRef.current.longitude}`
    : "no-location";
  /* eslint-enable react-hooks/refs */

  const sessionKey = [paused ? "paused" : "active", anchorKey, fusedRetry, restartKey].join(":");
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

    const fix = fixRef.current;
    const hasLocation =
      fix !== null && Number.isFinite(fix.latitude) && Number.isFinite(fix.longitude);
    // Only a provider fix carries a real fix time; a chosen city is stamped with when it was
    // picked, so passing that on would let native read it as evidence of a live location.
    const fixTimestamp =
      locationFromProvider && fix !== null && Number.isFinite(fix.timestamp) ? fix.timestamp : null;
    startedStaleRef.current =
      fixTimestamp !== null && Date.now() - fixTimestamp > MAX_FRESH_LOCATION_AGE_MS;

    log.i("Session", `starting sensor; locationReference=${hasLocation ? "provided" : "none"}`);

    // Declination depends only on location and date, so resolve it once per session and
    // reuse it to rotate every magnetic sample onto true north. Null past the model's
    // validity window; the reading then stays magnetic and the Qibla result is withheld.
    const declination = hasLocation
      ? getMagneticDeclination(fix.latitude, fix.longitude, fix.altitude, new Date())
      : null;
    if (hasLocation) {
      log.i(
        "Declination",
        declination !== null
          ? `applied ${declination.toFixed(1)}° for computed true north`
          : "model unavailable; using sensor reference only"
      );
    }

    let receivedEvent = false;
    let lastSource: OrientationSource = "unknown";
    let lastValidity: string | null = null;
    let lastDebugAt = 0;
    let staleTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastPublished: {
      heading: number;
      accuracyDegrees: number | null;
      tiltDegrees: number | null;
      northReference: CompassNorthReferenceValue;
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
          const sensorNorthReference = northReferences.has(event?.northReference)
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

          const rawHeading = headingIsValid ? event.heading : 0;
          const { heading, northReference } = isValid
            ? applyDeclinationCorrection(rawHeading, sensorNorthReference, declination)
            : { heading: rawHeading, northReference: sensorNorthReference };

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
        ...(hasLocation ? { latitude: fix.latitude, longitude: fix.longitude } : {}),
        ...(fix !== null && typeof fix.altitude === "number" && Number.isFinite(fix.altitude)
          ? { altitude: fix.altitude }
          : {}),
        ...(fixTimestamp !== null ? { locationTimestamp: fixTimestamp } : {}),
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
  }, [paused, sessionKey, locationFromProvider]);

  // Native declines the fused provider when the fix it started from is stale, leaving the
  // session on the raw sensor. A provider fix that arrives fresh earns one restart to reach
  // it; a session that already started fresh never retries, so a device that simply has no
  // fused provider is not restarted for every fix.
  useEffect(() => {
    if (paused || !startedStaleRef.current) return;
    if (!locationFromProvider || location === null) return;
    if (retriedForRef.current === location.timestamp) return;
    if (Date.now() - location.timestamp > MAX_FRESH_LOCATION_AGE_MS) return;
    retriedForRef.current = location.timestamp;
    // Only the session effect knows what the fix it started from was, so the retry cannot be
    // derived during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFusedRetry((retry) => retry + 1);
  }, [paused, locationFromProvider, location]);

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
