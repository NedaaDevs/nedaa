import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";
import { Info, LocateFixed } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import TopBar from "@/components/TopBar";
import { CompassDetailsSheet } from "@/components/compass/CompassDetailsSheet";
import { CompassDial } from "@/components/compass/CompassDial";
import { CompassIssueCard } from "@/components/compass/CompassIssueCard";
import { CompassOverlay } from "@/components/compass/CompassOverlay";
import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  CompassLocationSource,
  CompassNorthReference,
  CompassReliabilityIssue,
  type CompassReliabilityIssueValue,
} from "@/enums/compass";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useCompass } from "@/hooks/useCompass";
import { useCompassLocation } from "@/hooks/useCompassLocation";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useHaptic } from "@/hooks/useHaptic";
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";
import type { CompassLocationFix } from "@/types/compass";
import { AppLogger } from "@/utils/appLogger";
import {
  calculateBearingUncertaintyDegrees,
  calculateDistanceToMecca,
  calculateQiblaDirection,
  canProvideAlignmentFeedback,
  getCalibrationOverlayVisible,
  getCompassLocationAge,
  getCompassSensorReliability,
  getHeadingReliabilityIssue,
  getNativeCompassReliabilityIssue,
  getQiblaProximityState,
  getTiltOverlayVisible,
  getTranslatedCompassDirection,
  getTurnDirection,
  type QiblaProximityState,
} from "@/utils/compass";
import { formatNumberToLocale } from "@/utils/number";

const log = AppLogger.create("compass");

const CALIBRATE_OVERLAY_DELAY_MS = 1_000;
const TILT_OVERLAY_DELAY_MS = 500;

const getSensorIssue = (
  compass: ReturnType<typeof useCompass>,
  requiresTrueNorth: boolean
): CompassReliabilityIssueValue | null => {
  if (!compass.isAvailable) return CompassReliabilityIssue.SENSOR_UNAVAILABLE;
  if (!compass.isActive) return CompassReliabilityIssue.SENSOR_STARTING;
  const nativeIssue = getNativeCompassReliabilityIssue(compass.error);
  if (nativeIssue) return nativeIssue;

  return getHeadingReliabilityIssue(
    {
      heading: compass.heading,
      accuracyDegrees: compass.accuracyDegrees,
      isValid: compass.isValid,
      northReference: compass.northReference,
      timestamp: compass.timestamp,
    },
    { now: compass.observedAt, requiresTrueNorth }
  );
};

const CompassScreen = () => {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const { isActive: isAppActive } = useAppVisibility();
  const qiblaSeed = useScreenshotSeed("qibla");
  const isScreenshotMode = qiblaSeed !== null;
  const location = useCompassLocation({
    active: isFocused && isAppActive && !isScreenshotMode,
  });
  const hapticSelection = useHaptic("selection");
  const hapticMedium = useHaptic("medium");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [sensorRestartKey, setSensorRestartKey] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [compassOnly, setCompassOnly] = useState(false);
  const previousHapticProximity = useRef<QiblaProximityState>("searching");

  const effectiveFix: CompassLocationFix | null = qiblaSeed
    ? {
        latitude: qiblaSeed.lat,
        longitude: qiblaSeed.lng,
        accuracyMeters: 3,
        altitude: null,
        timestamp: 1,
      }
    : location.fix;
  const locationSource = qiblaSeed ? CompassLocationSource.FRESH : location.source;

  const compassPaused = isScreenshotMode || !isFocused || !isAppActive;
  const liveCompass = useCompass({
    paused: compassPaused,
    location: effectiveFix,
    restartKey: sensorRestartKey,
  });
  const compass = qiblaSeed
    ? {
        heading: qiblaSeed.heading,
        accuracyDegrees: 3,
        northReference: CompassNorthReference.TRUE,
        isAvailable: true,
        isActive: true,
        isValid: true,
        timestamp: 1,
        observedAt: 1,
        source: "cl_location" as const,
        error: null,
        tiltDegrees: null,
      }
    : liveCompass;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  // Compass-only mode is the user's escape hatch when true north cannot be resolved
  // (native heading magnetic and the declination model unavailable): drop the Qibla
  // requirement and show the magnetic dial rather than a blocking card.
  const requiresTrueNorth = effectiveFix !== null && !compassOnly;
  const sensorIssue = getSensorIssue(compass, requiresTrueNorth);

  // Unusable accuracy drives the calibrate overlay, not a blocking card. Any native error
  // that maps to the uncalibrated issue (sensor_unreliable, invalid_accuracy) counts.
  const sensorUnreliable =
    getNativeCompassReliabilityIssue(compass.error) === CompassReliabilityIssue.SENSOR_UNCALIBRATED;
  /* eslint-disable react-hooks/refs -- hysteresis is a pure fn of the ref's own previous value,
     mutated in place during render so each frame sees the latest reading without an extra effect tick */
  const calibrateRawRef = useRef(false);
  calibrateRawRef.current = getCalibrationOverlayVisible(
    compass.accuracyDegrees,
    sensorUnreliable,
    calibrateRawRef.current
  );
  const showCalibrate = useDelayedFlag(calibrateRawRef.current, CALIBRATE_OVERLAY_DELAY_MS);

  const tiltRawRef = useRef(false);
  tiltRawRef.current = getTiltOverlayVisible(compass.tiltDegrees, tiltRawRef.current);
  const showHoldFlat = useDelayedFlag(tiltRawRef.current, TILT_OVERLAY_DELAY_MS) && !showCalibrate;
  /* eslint-enable react-hooks/refs */

  const blockingIssue =
    sensorIssue === CompassReliabilityIssue.SENSOR_UNCALIBRATED ? null : sensorIssue;
  const isStartingSensor = blockingIssue === CompassReliabilityIssue.SENSOR_STARTING;
  const isReady = blockingIssue === null;

  const hasTrueNorth =
    compass.northReference === CompassNorthReference.TRUE ||
    compass.northReference === CompassNorthReference.TRUE_COMPUTED;
  const hasQibla = isReady && effectiveFix !== null && hasTrueNorth;
  const qiblaDirection =
    hasQibla && effectiveFix
      ? calculateQiblaDirection(effectiveFix.latitude, effectiveFix.longitude)
      : null;
  const distanceKm =
    hasQibla && effectiveFix
      ? calculateDistanceToMecca(effectiveFix.latitude, effectiveFix.longitude)
      : null;
  const bearingUncertainty =
    effectiveFix && distanceKm !== null
      ? calculateBearingUncertaintyDegrees(effectiveFix.accuracyMeters, distanceKm * 1_000)
      : 0;
  const canAlign =
    isReady &&
    qiblaDirection !== null &&
    !showCalibrate &&
    canProvideAlignmentFeedback(compass.accuracyDegrees, bearingUncertainty);
  const proximityState: QiblaProximityState = canAlign
    ? getQiblaProximityState(compass.heading, qiblaDirection)
    : "searching";

  useEffect(() => {
    if (!isReady || !canAlign || qiblaDirection === null) {
      previousHapticProximity.current = "searching";
      return;
    }
    const previous = previousHapticProximity.current;
    const next = getQiblaProximityState(compass.heading, qiblaDirection, previous);
    previousHapticProximity.current = next;
    if (next === "aligned" && previous !== "aligned") void hapticMedium();
  }, [canAlign, compass.heading, hapticMedium, isReady, qiblaDirection]);

  const reliabilityKey = `${locationSource}:${blockingIssue ?? "ready"}:${showCalibrate}:${compass.source}:${compass.northReference}`;
  const previousReliabilityKey = useRef<string | null>(null);
  useEffect(() => {
    if (previousReliabilityKey.current === reliabilityKey) return;
    previousReliabilityKey.current = reliabilityKey;
    log.i(
      "Reliability",
      `state=${blockingIssue ?? "ready"} calibrateOverlay=${showCalibrate} location=${locationSource} source=${compass.source} northReference=${compass.northReference}`
    );
  }, [
    blockingIssue,
    compass.northReference,
    compass.source,
    locationSource,
    reliabilityKey,
    showCalibrate,
  ]);

  const requestLocation = useCallback(() => {
    void hapticSelection();
    if (location.needsSettings) {
      void location.openSettings();
      return;
    }
    void location.refresh();
  }, [hapticSelection, location]);
  const retrySensor = useCallback(() => {
    void hapticSelection();
    setSensorRestartKey((value) => value + 1);
  }, [hapticSelection]);
  const enableCompassOnly = useCallback(() => {
    void hapticSelection();
    setCompassOnly(true);
  }, [hapticSelection]);
  const openDetails = useCallback(() => {
    void hapticSelection();
    setDetailsOpen(true);
  }, [hapticSelection]);

  const turnDirection =
    qiblaDirection === null ? null : getTurnDirection(compass.heading, qiblaDirection);
  const hintText =
    proximityState === "aligned"
      ? t("compass.facingQibla")
      : turnDirection === "right"
        ? t("compass.hint.turnRight")
        : turnDirection === "left"
          ? t("compass.hint.turnLeft")
          : "";

  const headingRounded = Math.round(compass.heading) % 360;
  const headingText = `${formatNumberToLocale(`${headingRounded}`)}° ${getTranslatedCompassDirection(compass.heading, t)}`;
  const northReferenceLabel = t(
    compass.northReference === CompassNorthReference.MAGNETIC
      ? "compass.northReference.magnetic"
      : compass.northReference === CompassNorthReference.TRUE_COMPUTED
        ? "compass.northReference.trueComputed"
        : "compass.northReference.true"
  );
  const sensorAccuracyText =
    compass.accuracyDegrees !== null && Number.isFinite(compass.accuracyDegrees)
      ? t("compass.accuracyDegrees", {
          degrees: formatNumberToLocale(`${Math.round(compass.accuracyDegrees)}`),
        })
      : t("compass.accuracyUnknown");
  const sensorReliabilityText = t(
    `compass.sensorReliability.${getCompassSensorReliability(compass.accuracyDegrees)}`
  );
  const distanceText =
    distanceKm === null
      ? null
      : `${formatNumberToLocale(`${Math.round(distanceKm)}`)} ${t("compass.km")}`;
  const qiblaText =
    qiblaDirection === null
      ? null
      : `${formatNumberToLocale(`${Math.round(qiblaDirection) % 360}`)}° ${getTranslatedCompassDirection(qiblaDirection, t)}`;
  const savedAge =
    effectiveFix && locationSource === CompassLocationSource.SAVED
      ? getCompassLocationAge(effectiveFix.timestamp)
      : null;
  const locationText = effectiveFix
    ? [
        t("compass.locationAccuracyMeters", {
          meters: formatNumberToLocale(`${Math.round(effectiveFix.accuracyMeters)}`),
        }),
        savedAge ? t(`compass.locationSavedAge.${savedAge.unit}`, { count: savedAge.value }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const isNearKaaba = distanceKm !== null && distanceKm < 1;
  const showOverlay = showCalibrate || showHoldFlat;

  return (
    <Background>
      <TopBar title="compass.title" href="/(tabs)/tools" backOnClick preferHref />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <VStack
          flex={1}
          width="100%"
          alignItems="center"
          justifyContent="center"
          gap="$5"
          paddingHorizontal="$6"
          paddingTop="$4"
          paddingBottom="$8">
          {isStartingSensor ? (
            <VStack alignItems="center" gap="$4" accessibilityLiveRegion="polite">
              <Spinner size="large" />
              <Text color="$typographySecondary" textAlign="center">
                {t("compass.issue.sensor_starting.body")}
              </Text>
            </VStack>
          ) : blockingIssue ? (
            <CompassIssueCard
              title={t(`compass.issue.${blockingIssue}.title`)}
              body={t(`compass.issue.${blockingIssue}.body`)}
              action="retry"
              onAction={retrySensor}
              secondaryAction={
                blockingIssue === CompassReliabilityIssue.TRUE_NORTH_UNAVAILABLE
                  ? "compassOnly"
                  : null
              }
              onSecondaryAction={enableCompassOnly}
            />
          ) : (
            <>
              <Text
                color={proximityState === "aligned" ? "$primary" : "$typographySecondary"}
                size="lg"
                fontWeight={proximityState === "aligned" ? "700" : "500"}
                minHeight={28}
                accessibilityLiveRegion="polite">
                {hintText}
              </Text>

              <Box>
                <CompassDial
                  heading={compass.heading}
                  qiblaDirection={qiblaDirection}
                  proximityState={proximityState}
                  reduceMotion={reduceMotion}
                  dimmed={showOverlay}
                  accessibilityLabel={t("a11y.compass.dial", {
                    heading: `${headingRounded}`,
                    reference: northReferenceLabel,
                  })}
                  translateDirection={t}
                />
                {showCalibrate && (
                  <CompassOverlay variant="calibrate" reduceMotion={reduceMotion} />
                )}
                {showHoldFlat && <CompassOverlay variant="holdFlat" reduceMotion={reduceMotion} />}
              </Box>

              {distanceText !== null && (
                <Text color="$typographySecondary" size="sm">
                  {distanceText.concat(" · ", t("compass.details.distance"))}
                </Text>
              )}

              {effectiveFix === null && (
                <Pressable
                  onPress={requestLocation}
                  disabled={location.isRefreshing}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.compass.enableLocation")}
                  style={{ minHeight: 44, justifyContent: "center" }}>
                  <HStack alignItems="center" gap="$2">
                    {location.isRefreshing ? (
                      <Spinner size="small" />
                    ) : (
                      <Icon as={LocateFixed} size="sm" color="$primary" />
                    )}
                    <Text color="$primary" size="md" fontWeight="600">
                      {location.isRefreshing ? t("compass.locating") : t("compass.enableLocation")}
                    </Text>
                  </HStack>
                </Pressable>
              )}

              {isNearKaaba && (
                <Text color="$primary" size="lg" bold textAlign="center">
                  {t("compass.nearKaaba")}
                </Text>
              )}

              <Pressable
                onPress={openDetails}
                accessibilityRole="button"
                accessibilityLabel={t("compass.details.title")}
                accessibilityHint={t("a11y.compass.details")}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                <Icon as={Info} size="md" color="$typographySecondary" />
              </Pressable>
            </>
          )}
        </VStack>
      </ScrollView>

      {/* Freeze content while closed: the fit-mode sheet re-measures on content change, and these
          strings would otherwise churn on every sensor sample. */}
      <CompassDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        headingText={detailsOpen ? headingText : ""}
        qiblaText={detailsOpen ? qiblaText : null}
        distanceText={detailsOpen ? distanceText : null}
        sensorAccuracyText={detailsOpen ? sensorAccuracyText : ""}
        sensorReliabilityText={detailsOpen ? sensorReliabilityText : ""}
        northReferenceText={detailsOpen ? northReferenceLabel : ""}
        locationText={detailsOpen ? locationText : null}
        isRefreshing={detailsOpen ? location.isRefreshing : false}
        canRefreshLocation={!isScreenshotMode}
        onRefreshLocation={requestLocation}
      />
    </Background>
  );
};

export default CompassScreen;
