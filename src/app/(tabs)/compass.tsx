import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ScrollView } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";
import { LocateFixed } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import TopBar from "@/components/TopBar";
import { CompassDial } from "@/components/compass/CompassDial";
import { CompassInfoCard } from "@/components/compass/CompassInfoCard";
import { CompassIssueCard } from "@/components/compass/CompassIssueCard";
import { CompassModeSwitch } from "@/components/compass/CompassModeSwitch";
import { CompassSetupCard } from "@/components/compass/CompassSetupCard";
import { Background } from "@/components/ui/background";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  CompassLocationPreference,
  CompassLocationSource,
  CompassNorthReference,
  CompassReliabilityIssue,
  type CompassReliabilityIssueValue,
} from "@/enums/compass";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useCompass } from "@/hooks/useCompass";
import { useCompassLocation } from "@/hooks/useCompassLocation";
import { useHaptic } from "@/hooks/useHaptic";
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";
import type { CompassLocationFix } from "@/types/compass";
import { AppLogger } from "@/utils/appLogger";
import {
  calculateBearingUncertaintyDegrees,
  calculateDistanceToMecca,
  calculateQiblaDirection,
  canProvideAlignmentFeedback,
  getCompassSensorIssueAction,
  getHeadingReliabilityIssue,
  getNativeCompassReliabilityIssue,
  getQiblaProximityState,
  getTranslatedCompassDirection,
  type QiblaProximityState,
} from "@/utils/compass";
import { formatNumberToLocale } from "@/utils/number";

const log = AppLogger.create("compass");

const locationIssues = new Set<CompassReliabilityIssueValue>([
  CompassReliabilityIssue.LOCATION_REQUIRED,
  CompassReliabilityIssue.LOCATION_PERMISSION_DENIED,
  CompassReliabilityIssue.LOCATION_PERMISSION_BLOCKED,
  CompassReliabilityIssue.LOCATION_SERVICES_DISABLED,
  CompassReliabilityIssue.LOCATION_TIMEOUT,
  CompassReliabilityIssue.LOCATION_REDUCED_ACCURACY,
  CompassReliabilityIssue.LOCATION_TOO_INACCURATE,
  CompassReliabilityIssue.LOCATION_STALE,
]);

const settingsIssues = new Set<CompassReliabilityIssueValue>([
  CompassReliabilityIssue.LOCATION_PERMISSION_BLOCKED,
  CompassReliabilityIssue.LOCATION_REDUCED_ACCURACY,
  CompassReliabilityIssue.LOCATION_SERVICES_DISABLED,
]);

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
    {
      // The hook owns the live stale timer and records when this sample was observed.
      now: compass.observedAt,
      requiresTrueNorth,
    }
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
  const previousHapticProximity = useRef<QiblaProximityState>("searching");

  const preference = isScreenshotMode ? CompassLocationPreference.QIBLA : location.preference;
  const isQiblaMode = preference === CompassLocationPreference.QIBLA;
  const isCompassOnly = preference === CompassLocationPreference.COMPASS_ONLY;
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

  const compassPaused =
    isScreenshotMode ||
    !isFocused ||
    !isAppActive ||
    preference === CompassLocationPreference.ASK ||
    (isQiblaMode && effectiveFix === null);
  const liveCompass = useCompass({
    paused: compassPaused,
    location: isQiblaMode ? effectiveFix : null,
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

  const locationIssue =
    isQiblaMode && effectiveFix === null
      ? (location.issue ?? CompassReliabilityIssue.LOCATION_REQUIRED)
      : null;
  const sensorIssue =
    preference === CompassLocationPreference.ASK || locationIssue
      ? null
      : getSensorIssue(compass, isQiblaMode);
  const blockingIssue = locationIssue ?? sensorIssue;
  const isStartingSensor = blockingIssue === CompassReliabilityIssue.SENSOR_STARTING;
  const isLocating = isQiblaMode && location.isRefreshing && effectiveFix === null;
  const isReady =
    (isQiblaMode || isCompassOnly) &&
    ((isQiblaMode && effectiveFix !== null) || (isCompassOnly && effectiveFix === null)) &&
    blockingIssue === null;

  const qiblaDirection =
    isReady && isQiblaMode && effectiveFix
      ? calculateQiblaDirection(effectiveFix.latitude, effectiveFix.longitude)
      : null;
  const distanceKm =
    isReady && isQiblaMode && effectiveFix
      ? calculateDistanceToMecca(effectiveFix.latitude, effectiveFix.longitude)
      : null;
  const bearingUncertainty =
    effectiveFix && distanceKm !== null
      ? calculateBearingUncertaintyDegrees(effectiveFix.accuracyMeters, distanceKm * 1_000)
      : 0;
  const canAlign =
    isReady &&
    isQiblaMode &&
    qiblaDirection !== null &&
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
    if (next === "aligned" && previous !== "aligned") {
      void hapticMedium();
    }
  }, [canAlign, compass.heading, hapticMedium, isReady, qiblaDirection]);

  const reliabilityKey = `${preference}:${locationSource}:${blockingIssue ?? "ready"}:${compass.source}:${compass.northReference}`;
  const previousReliabilityKey = useRef<string | null>(null);
  useEffect(() => {
    if (previousReliabilityKey.current === reliabilityKey) return;
    previousReliabilityKey.current = reliabilityKey;

    if (blockingIssue) {
      log.w(
        "Reliability",
        `state=withheld issue=${blockingIssue} mode=${preference} source=${compass.source}`
      );
    } else if (isReady) {
      log.i(
        "Reliability",
        `state=ready mode=${preference} location=${locationSource} northReference=${compass.northReference}`
      );
    }
  }, [
    blockingIssue,
    compass.northReference,
    compass.source,
    isReady,
    locationSource,
    preference,
    reliabilityKey,
  ]);

  const chooseQibla = useCallback(() => {
    void hapticSelection();
    void location.chooseQibla();
  }, [hapticSelection, location]);
  const chooseCompassOnly = useCallback(() => {
    void hapticSelection();
    location.chooseCompassOnly();
  }, [hapticSelection, location]);
  const refreshLocation = useCallback(() => {
    void hapticSelection();
    void location.refresh();
  }, [hapticSelection, location]);
  const openSettings = useCallback(() => {
    void hapticSelection();
    void location.openSettings();
  }, [hapticSelection, location]);
  const retrySensor = useCallback(() => {
    void hapticSelection();
    setSensorRestartKey((value) => value + 1);
  }, [hapticSelection]);

  const issueAction = useMemo(() => {
    if (!blockingIssue) return null;
    if (
      settingsIssues.has(blockingIssue) ||
      (blockingIssue === CompassReliabilityIssue.TRUE_NORTH_UNAVAILABLE && location.needsSettings)
    ) {
      return "settings" as const;
    }
    if (
      locationIssues.has(blockingIssue) ||
      blockingIssue === CompassReliabilityIssue.TRUE_NORTH_UNAVAILABLE
    ) {
      return "retry" as const;
    }
    return getCompassSensorIssueAction(blockingIssue);
  }, [blockingIssue, location.needsSettings]);
  const issueActionHandler =
    issueAction === "settings"
      ? openSettings
      : blockingIssue &&
          (locationIssues.has(blockingIssue) ||
            blockingIssue === CompassReliabilityIssue.TRUE_NORTH_UNAVAILABLE)
        ? refreshLocation
        : retrySensor;

  const headingRounded = Math.round(compass.heading) % 360;
  const headingText = formatNumberToLocale(`${headingRounded}`);
  const northReferenceLabel = t(
    compass.northReference === CompassNorthReference.MAGNETIC
      ? "compass.northReference.magnetic"
      : "compass.northReference.true"
  );
  const cardinalText =
    proximityState === "aligned"
      ? t("compass.facingQibla")
      : getTranslatedCompassDirection(compass.heading, t);
  const sensorAccuracyText = t("compass.accuracyDegrees", {
    degrees: formatNumberToLocale(`${Math.round(compass.accuracyDegrees ?? 0)}`),
  });
  const locationAccuracyText = effectiveFix
    ? t("compass.locationAccuracyMeters", {
        meters: formatNumberToLocale(`${Math.round(effectiveFix.accuracyMeters)}`),
      })
    : null;
  const qiblaDirectionText =
    qiblaDirection === null
      ? null
      : `${formatNumberToLocale(`${Math.round(qiblaDirection) % 360}`)}°`;
  const distanceText =
    distanceKm === null
      ? null
      : `${formatNumberToLocale(`${Math.round(distanceKm)}`)} ${t("compass.km")}`;
  const isNearKaaba = distanceKm !== null && distanceKm < 1;

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
          {preference !== CompassLocationPreference.ASK && !isScreenshotMode && (
            <CompassModeSwitch
              isQiblaMode={isQiblaMode}
              onChooseQibla={chooseQibla}
              onChooseCompassOnly={chooseCompassOnly}
            />
          )}

          {preference === CompassLocationPreference.ASK ? (
            <CompassSetupCard
              isRefreshing={location.isRefreshing}
              onChooseQibla={chooseQibla}
              onChooseCompassOnly={chooseCompassOnly}
            />
          ) : isLocating ? (
            <Card
              width="100%"
              maxWidth={420}
              padding="$6"
              gap="$4"
              alignItems="center"
              accessibilityLiveRegion="polite">
              <Icon as={LocateFixed} size="xl" color="$primary" />
              <Spinner size="large" />
              <Text size="lg" bold textAlign="center">
                {t("compass.locating")}
              </Text>
              <Text size="sm" color="$typographySecondary" textAlign="center">
                {t("compass.disclaimer")}
              </Text>
            </Card>
          ) : isStartingSensor ? (
            <Card
              width="100%"
              maxWidth={420}
              padding="$6"
              gap="$4"
              alignItems="center"
              accessibilityLiveRegion="polite">
              <Spinner size="large" />
              <Text size="lg" bold textAlign="center">
                {t("compass.issue.sensor_starting.title")}
              </Text>
              <Text color="$typographySecondary" textAlign="center">
                {t("compass.issue.sensor_starting.body")}
              </Text>
            </Card>
          ) : blockingIssue ? (
            <CompassIssueCard
              title={t(`compass.issue.${blockingIssue}.title`)}
              body={t(`compass.issue.${blockingIssue}.body`)}
              action={issueAction}
              isRefreshing={location.isRefreshing}
              onAction={issueActionHandler}
            />
          ) : isReady ? (
            <>
              <VStack alignItems="center" gap="$1">
                <Text
                  color={proximityState === "aligned" ? "$primary" : "$typography"}
                  size="4xl"
                  bold
                  accessibilityLabel={`${headingRounded} ${t("compass.currentDirection")}`}>
                  {headingText}°
                </Text>
                <Text
                  color={proximityState === "aligned" ? "$primary" : "$typographySecondary"}
                  size="md"
                  fontWeight={proximityState === "aligned" ? "600" : "400"}>
                  {cardinalText}
                </Text>
              </VStack>

              <CompassDial
                heading={compass.heading}
                qiblaDirection={qiblaDirection}
                proximityState={proximityState}
                reduceMotion={reduceMotion}
                accessibilityLabel={t("a11y.compass.dial", {
                  heading: headingText,
                  reference: northReferenceLabel,
                })}
                translateDirection={t}
              />

              <CompassInfoCard
                isQiblaMode={isQiblaMode}
                isSavedLocation={locationSource === CompassLocationSource.SAVED}
                isRefreshing={location.isRefreshing}
                needsSettings={location.needsSettings}
                northReferenceLabel={northReferenceLabel}
                sensorAccuracyText={sensorAccuracyText}
                qiblaDirectionText={qiblaDirectionText}
                qiblaCardinalText={
                  qiblaDirection === null ? null : getTranslatedCompassDirection(qiblaDirection, t)
                }
                distanceText={distanceText}
                locationAccuracyText={isQiblaMode ? locationAccuracyText : null}
                fallbackWarningTitle={
                  locationSource === CompassLocationSource.SAVED && location.issue
                    ? t(`compass.issue.${location.issue}.title`)
                    : null
                }
                fallbackWarningBody={
                  locationSource === CompassLocationSource.SAVED && location.issue
                    ? t(`compass.issue.${location.issue}.body`)
                    : null
                }
                onRefresh={refreshLocation}
                onOpenSettings={openSettings}
              />

              {isNearKaaba && (
                <Text color="$primary" size="lg" bold textAlign="center">
                  {t("compass.nearKaaba")}
                </Text>
              )}
            </>
          ) : null}
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default CompassScreen;
