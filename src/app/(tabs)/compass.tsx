import { useState, useEffect, useRef, useMemo } from "react";
import { AccessibilityInfo } from "react-native";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from "react-native-reanimated";
import { Svg, Circle, Line, Text as SvgText, G, Rect } from "react-native-svg";

import { Background } from "@/components/ui/background";
import { Center } from "@/components/ui/center";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import TopBar from "@/components/TopBar";

import { useLocationStore } from "@/stores/location";
import { useCompass } from "@/hooks/useCompass";
import { useHaptic } from "@/hooks/useHaptic";
import { useTheme } from "tamagui";
import {
  calculateQiblaDirection,
  calculateDistanceToMecca,
  getTranslatedCompassDirection,
  getQiblaProximityState,
  formatDistanceToMecca,
  type QiblaProximityState,
} from "@/utils/compass";
import { reshapeArabic } from "@/utils/reshaper";
import { formatNumberToLocale } from "@/utils/number";

const compassSize = 300;
const centerX = compassSize / 2;
const centerY = compassSize / 2;
const radius = 110;
const letterDistance = radius - 20;

const tickMarks = Array.from({ length: 36 }, (_, i) => {
  const angleDeg = i * 10;
  const angleRad = angleDeg * (Math.PI / 180);
  const isLong = i % 3 === 0;
  const outerR = radius;
  const innerR = radius - (isLong ? 12 : 6);
  return {
    key: `tick-${i}`,
    x1: centerX + Math.sin(angleRad) * innerR,
    y1: centerY - Math.cos(angleRad) * innerR,
    x2: centerX + Math.sin(angleRad) * outerR,
    y2: centerY - Math.cos(angleRad) * outerR,
    strokeWidth: isLong ? 2 : 1,
  };
});

const Compass = () => {
  const isFocused = useIsFocused();
  const { heading, accuracy, isAvailable, isActive } = useCompass(!isFocused);
  const { locationDetails } = useLocationStore();
  const theme = useTheme();
  const { t } = useTranslation();

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const colors = useMemo(
    () => ({
      primary: theme.primary.val,
      secondary: theme.typographySecondary.val,
      text: theme.typography.val,
      background: theme.backgroundSecondary.val,
      contrast: theme.typographyContrast.val,
      north: theme.error.val,
    }),
    [theme]
  );

  const qiblaDirection = locationDetails.coords
    ? calculateQiblaDirection(locationDetails.coords.latitude, locationDetails.coords.longitude)
    : null;

  const proximityState: QiblaProximityState =
    qiblaDirection !== null && isActive
      ? getQiblaProximityState(heading, qiblaDirection)
      : "searching";

  const distanceKm = locationDetails.coords
    ? calculateDistanceToMecca(locationDetails.coords.latitude, locationDetails.coords.longitude)
    : null;

  const isNearKaaba = distanceKm !== null && distanceKm < 1;

  const distanceText = locationDetails.coords
    ? formatDistanceToMecca(
        locationDetails.coords.latitude,
        locationDetails.coords.longitude,
        t("compass.km")
      )
    : null;

  // Reanimated shared values
  const rotationValue = useSharedValue(0);

  useEffect(() => {
    rotationValue.value = withTiming(-heading, { duration: reduceMotion ? 0 : 150 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heading, reduceMotion]);

  const compassRotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationValue.value}deg` }],
  }));

  // Qibla dot radius scales with proximity state
  const qiblaDotRadius =
    proximityState === "aligned" ? 18 : proximityState === "approaching" ? 16 : 14;

  // Haptic feedback on state transitions
  const hapticMedium = useHaptic("medium");
  const hapticLight = useHaptic("light");
  const prevProximityRef = useRef<QiblaProximityState>("searching");
  const lastHapticTimeRef = useRef(0);

  useEffect(() => {
    const prev = prevProximityRef.current;
    prevProximityRef.current = proximityState;

    const now = Date.now();
    if (now - lastHapticTimeRef.current < 500) return;

    if (proximityState === "aligned" && prev !== "aligned") {
      hapticMedium();
      lastHapticTimeRef.current = now;
    } else if (prev === "aligned" && proximityState !== "aligned") {
      hapticLight();
      lastHapticTimeRef.current = now;
    }
  }, [proximityState, hapticMedium, hapticLight]);

  // Ring color based on proximity state
  const ringColor =
    proximityState === "aligned"
      ? colors.primary
      : proximityState === "approaching"
        ? colors.primary
        : colors.secondary;

  const ringOpacity = proximityState === "approaching" ? 0.6 : 1;

  // Qibla indicator position on the ring
  const qiblaX =
    qiblaDirection !== null
      ? centerX + Math.sin((qiblaDirection * Math.PI) / 180) * (radius + 15)
      : 0;
  const qiblaY =
    qiblaDirection !== null
      ? centerY - Math.cos((qiblaDirection * Math.PI) / 180) * (radius + 15)
      : 0;

  // Cardinal direction positions
  const cardinals = useMemo(() => {
    return [
      {
        key: "N",
        x: centerX,
        y: centerY - letterDistance,
        anchor: "middle" as const,
        color: colors.north,
        fontSize: 18,
      },
      {
        key: "S",
        x: centerX,
        y: centerY + letterDistance,
        anchor: "middle" as const,
        color: colors.secondary,
        fontSize: 16,
      },
      {
        key: "E",
        x: centerX + letterDistance + 5,
        y: centerY + 5,
        anchor: "end" as const,
        color: colors.secondary,
        fontSize: 16,
      },
      {
        key: "W",
        x: centerX - letterDistance - 5,
        y: centerY + 5,
        anchor: "start" as const,
        color: colors.secondary,
        fontSize: 16,
      },
    ];
  }, [colors.north, colors.secondary]);

  const headingRounded = Math.round(heading);
  const headingText = formatNumberToLocale(`${headingRounded}`);
  const isAligned = proximityState === "aligned";
  const cardinalText = isActive
    ? isAligned
      ? t("compass.facingQibla")
      : getTranslatedCompassDirection(heading, t)
    : "";
  const headingColor = isAligned ? "$primary" : "$typography";
  const subtitleColor = isAligned ? "$primary" : "$typographySecondary";

  const lowAccuracy = accuracy < 50;

  // Ring pulse animation when aligned
  const ringPulse = useSharedValue(1);
  useEffect(() => {
    if (isAligned && !reduceMotion) {
      ringPulse.value = withRepeat(
        withSequence(withTiming(0.5, { duration: 1000 }), withTiming(1, { duration: 1000 })),
        -1,
        true
      );
    } else {
      ringPulse.value = withTiming(1, { duration: 300 });
    }
  }, [isAligned, reduceMotion, ringPulse]);

  const ringPulseStyle = useAnimatedStyle(() => ({
    opacity: ringPulse.value,
  }));

  return (
    <Background>
      <TopBar title="compass.title" href="/(tabs)/tools" backOnClick />

      <Center flex={1} paddingHorizontal="$6">
        {!isAvailable ? (
          <Text color="$error" textAlign="center" fontWeight="500">
            {t("compass.notAvailable")}
          </Text>
        ) : !isActive ? (
          <Text color="$typographySecondary" textAlign="center">
            {t("compass.starting")}
          </Text>
        ) : (
          <VStack alignItems="center" gap="$4" width="100%">
            {/* Heading number */}
            <VStack alignItems="center" gap="$1">
              <Text
                color={headingColor}
                size="4xl"
                bold
                accessibilityLabel={`${headingRounded} ${t("compass.currentDirection")}`}>
                {headingText}°
              </Text>
              <Text color={subtitleColor} size="md" fontWeight={isAligned ? "600" : "400"}>
                {cardinalText}
              </Text>
            </VStack>

            {/* Compass visual */}
            <Box alignItems="center" justifyContent="center">
              {/* Pulse glow when aligned */}
              {isAligned && (
                <Animated.View
                  style={[
                    ringPulseStyle,
                    {
                      position: "absolute",
                      top: 14,
                      width: compassSize,
                      height: compassSize,
                      borderRadius: compassSize / 2,
                      borderWidth: 3,
                      borderColor: colors.primary,
                    },
                  ]}
                />
              )}
              {/* Fixed reference notch at top */}
              <Box position="absolute" top={0} zIndex={10} alignItems="center">
                <Svg width={20} height={14}>
                  <Line
                    x1={10}
                    y1={0}
                    x2={10}
                    y2={14}
                    stroke={colors.primary}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                </Svg>
              </Box>

              {/* Rotating compass */}
              <Animated.View
                style={[compassRotationStyle, { marginTop: 14 }]}
                accessible={true}
                accessibilityLabel={`${headingRounded}° ${cardinalText}`}
                importantForAccessibility="no-hide-descendants">
                <Svg width={compassSize} height={compassSize}>
                  {/* Outer ring */}
                  <Circle
                    cx={centerX}
                    cy={centerY}
                    r={radius}
                    stroke={ringColor}
                    strokeWidth={2}
                    fill="none"
                    opacity={ringOpacity}
                  />

                  {/* Tick marks */}
                  {tickMarks.map((tick) => (
                    <Line
                      key={tick.key}
                      x1={tick.x1}
                      y1={tick.y1}
                      x2={tick.x2}
                      y2={tick.y2}
                      stroke={colors.secondary}
                      strokeWidth={tick.strokeWidth}
                    />
                  ))}

                  {/* Cardinal direction letters */}
                  {cardinals.map((dir) => (
                    <SvgText
                      key={dir.key}
                      x={dir.x}
                      y={dir.y}
                      textAnchor={dir.anchor}
                      alignmentBaseline="middle"
                      fontSize={dir.fontSize}
                      fontWeight="bold"
                      fontFamily="IBMPlexSans-Regular"
                      fill={dir.color}>
                      {reshapeArabic(t(`compass.directions.${dir.key}`))}
                    </SvgText>
                  ))}

                  {/* Crosshair center */}
                  <Line
                    x1={centerX}
                    y1={centerY - 20}
                    x2={centerX}
                    y2={centerY + 20}
                    stroke={colors.secondary}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    opacity={0.4}
                  />
                  <Line
                    x1={centerX - 20}
                    y1={centerY}
                    x2={centerX + 20}
                    y2={centerY}
                    stroke={colors.secondary}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    opacity={0.4}
                  />

                  {/* Qibla indicator */}
                  {qiblaDirection !== null && (
                    <G>
                      <Circle cx={qiblaX} cy={qiblaY} r={qiblaDotRadius} fill={colors.primary} />
                      <G rotation={45} origin={`${qiblaX}, ${qiblaY}`}>
                        <Rect x={qiblaX - 6} y={qiblaY - 6} width={12} height={12} fill="white" />
                      </G>
                    </G>
                  )}
                </Svg>
              </Animated.View>
            </Box>

            {/* Info card */}
            <Box width="100%" maxWidth={384}>
              <Box
                padding="$4"
                borderRadius="$6"
                backgroundColor="$backgroundSecondary"
                accessibilityLiveRegion="polite"
                accessibilityRole="summary">
                <VStack gap="$3">
                  {/* Qibla direction row */}
                  {qiblaDirection !== null && (
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text color="$typography" fontWeight="500">
                        {t("compass.qiblaDirection")}
                      </Text>
                      <HStack alignItems="center" gap="$2">
                        <Text color="$primary" size="xl" bold>
                          {formatNumberToLocale(`${Math.round(qiblaDirection)}`)}°
                        </Text>
                        <Box width={32}>
                          <Text color="$typographySecondary" size="sm" textAlign="center">
                            {getTranslatedCompassDirection(qiblaDirection, t)}
                          </Text>
                        </Box>
                      </HStack>
                    </HStack>
                  )}

                  {/* Distance to Mecca row */}
                  {distanceText && (
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text color="$typography" fontWeight="500">
                        {t("compass.distance")}
                      </Text>
                      <Text color="$typographySecondary" size="md">
                        {formatNumberToLocale(distanceText)}
                      </Text>
                    </HStack>
                  )}

                  {/* Accuracy row */}
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text color="$typography" fontWeight="500">
                      {t("compass.accuracy")}
                    </Text>
                    <Text color="$typographySecondary" size="md">
                      {accuracy > 0
                        ? `±${formatNumberToLocale(`${Math.round(accuracy)}`)}°`
                        : t("compass.starting")}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            </Box>

            {/* Near Kaaba blessing */}
            {isNearKaaba && (
              <Box paddingHorizontal="$4" paddingVertical="$2">
                <Text color="$primary" size="lg" bold textAlign="center">
                  {t("compass.nearKaaba")}
                </Text>
              </Box>
            )}

            {/* Calibration hint */}
            {lowAccuracy && (
              <Box paddingHorizontal="$4" paddingVertical="$2">
                <Text color="$typographySecondary" size="xs" textAlign="center">
                  {t("compass.calibrationNote")}
                </Text>
              </Box>
            )}
          </VStack>
        )}
      </Center>
    </Background>
  );
};

export default Compass;
