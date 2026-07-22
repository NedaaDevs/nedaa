import { useEffect, useMemo, useRef } from "react";
import { useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { MotiView } from "moti";
import { Circle, G, Line, Svg, Text as SvgText } from "react-native-svg";
import { useTheme } from "tamagui";

import {
  KAABA_VIEWBOX_HEIGHT,
  KAABA_VIEWBOX_WIDTH,
  KaabaShapes,
} from "@/components/compass/KaabaGlyph";
import { Box } from "@/components/ui/box";
import type { QiblaProximityState } from "@/utils/compass";
import { applyHeadingDeadband, unwrapHeading } from "@/utils/compass";
import { reshapeArabic } from "@/utils/reshaper";

const VIEWBOX_SIZE = 300;
const CENTER = VIEWBOX_SIZE / 2;
const RADIUS = 110;
const LETTER_DISTANCE = RADIUS - 20;
const MARKER_SCALE = 0.6;
const HERO_SIZE = 44;

// Critically damped: no overshoot, settles fast, absorbs sample-rate jitter.
const ROTATION_SPRING = { mass: 1, stiffness: 120, damping: 22 };

const tickMarks = Array.from({ length: 36 }, (_, index) => {
  const angleDegrees = index * 10;
  const angleRadians = angleDegrees * (Math.PI / 180);
  const isLong = index % 3 === 0;
  const innerRadius = RADIUS - (isLong ? 12 : 6);

  return {
    key: `tick-${index}`,
    x1: CENTER + Math.sin(angleRadians) * innerRadius,
    y1: CENTER - Math.cos(angleRadians) * innerRadius,
    x2: CENTER + Math.sin(angleRadians) * RADIUS,
    y2: CENTER - Math.cos(angleRadians) * RADIUS,
    strokeWidth: isLong ? 2 : 1,
  };
});

type CompassDialProps = {
  heading: number;
  qiblaDirection: number | null;
  proximityState: QiblaProximityState;
  reduceMotion: boolean;
  accessibilityLabel: string;
  translateDirection: (key: string) => string;
  dimmed?: boolean;
};

export const CompassDial = ({
  heading,
  qiblaDirection,
  proximityState,
  reduceMotion,
  accessibilityLabel,
  translateDirection,
  dimmed = false,
}: CompassDialProps) => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const dialSize = Math.min(VIEWBOX_SIZE, Math.max(200, width - 64));
  const rotationValue = useSharedValue(-heading);
  const displayedHeading = useRef(heading);
  const unwrappedHeading = useRef(heading);
  const glow = useSharedValue(0);
  const isAligned = proximityState === "aligned";

  const colors = useMemo(
    () => ({
      primary: theme.primary.val,
      secondary: theme.typographySecondary.val,
      north: theme.error.val,
    }),
    [theme]
  );

  useEffect(() => {
    const next = applyHeadingDeadband(displayedHeading.current, heading);
    if (next === displayedHeading.current) return;
    displayedHeading.current = next;
    const nextUnwrapped = unwrapHeading(unwrappedHeading.current, next);
    unwrappedHeading.current = nextUnwrapped;
    rotationValue.value = reduceMotion
      ? -nextUnwrapped
      : withSpring(-nextUnwrapped, ROTATION_SPRING);
  }, [heading, reduceMotion, rotationValue]);

  useEffect(() => {
    const target = isAligned ? 1 : 0;
    glow.value = reduceMotion ? target : withTiming(target, { duration: 250 });
  }, [glow, isAligned, reduceMotion]);

  const compassRotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationValue.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * 0.6 }));

  const ringColor = proximityState === "searching" ? colors.secondary : colors.primary;
  const showRingMarker = qiblaDirection !== null && !isAligned;
  const markerX =
    qiblaDirection === null ? 0 : CENTER + Math.sin((qiblaDirection * Math.PI) / 180) * RADIUS;
  const markerY =
    qiblaDirection === null ? 0 : CENTER - Math.cos((qiblaDirection * Math.PI) / 180) * RADIUS;
  const markerWidth = KAABA_VIEWBOX_WIDTH * MARKER_SCALE;
  const markerHeight = KAABA_VIEWBOX_HEIGHT * MARKER_SCALE;

  const cardinals = [
    { key: "N", x: CENTER, y: CENTER - LETTER_DISTANCE, color: colors.north, fontSize: 18 },
    { key: "S", x: CENTER, y: CENTER + LETTER_DISTANCE, color: colors.secondary, fontSize: 16 },
    { key: "E", x: CENTER + LETTER_DISTANCE, y: CENTER, color: colors.secondary, fontSize: 16 },
    { key: "W", x: CENTER - LETTER_DISTANCE, y: CENTER, color: colors.secondary, fontSize: 16 },
  ];

  return (
    <Box
      width={dialSize}
      height={dialSize + 14}
      alignItems="center"
      justifyContent="flex-end"
      opacity={dimmed ? 0.4 : 1}
      accessible
      accessibilityLabel={accessibilityLabel}>
      <Animated.View
        pointerEvents="none"
        style={[
          glowStyle,
          {
            position: "absolute",
            bottom: 0,
            width: dialSize,
            height: dialSize,
            borderRadius: dialSize / 2,
            borderWidth: 3,
            borderColor: colors.primary,
            shadowColor: colors.primary,
            shadowOpacity: 0.6,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          },
        ]}
      />

      <Box position="absolute" top={0} zIndex={10} alignItems="center" pointerEvents="none">
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

      {isAligned && qiblaDirection !== null && (
        <MotiView
          testID="kaaba-hero"
          pointerEvents="none"
          {...(reduceMotion
            ? {}
            : {
                from: { scale: 0.55, opacity: 0 },
                animate: { scale: 1, opacity: 1 },
                transition: { type: "spring", stiffness: 220, damping: 18 },
              })}
          style={{ position: "absolute", top: 22, zIndex: 11 }}>
          <Svg
            width={HERO_SIZE}
            height={(HERO_SIZE * KAABA_VIEWBOX_HEIGHT) / KAABA_VIEWBOX_WIDTH}
            viewBox={`0 0 ${KAABA_VIEWBOX_WIDTH} ${KAABA_VIEWBOX_HEIGHT}`}>
            <KaabaShapes />
          </Svg>
        </MotiView>
      )}

      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={[compassRotationStyle, { width: dialSize, height: dialSize }]}>
        <Svg width={dialSize} height={dialSize} viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={2}
            fill="none"
          />

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

          {cardinals.map((direction) => (
            <SvgText
              key={direction.key}
              x={direction.x}
              y={direction.y}
              textAnchor="middle"
              alignmentBaseline="middle"
              fontSize={direction.fontSize}
              fontWeight="bold"
              fontFamily="IBMPlexSans-Regular"
              fill={direction.color}>
              {reshapeArabic(translateDirection(`compass.directions.${direction.key}`))}
            </SvgText>
          ))}

          {isAligned && qiblaDirection !== null && (
            <G testID="qibla-path-line">
              <Line
                x1={CENTER}
                y1={CENTER}
                x2={markerX}
                y2={markerY}
                stroke={colors.primary}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <Circle cx={CENTER} cy={CENTER} r={5} fill={colors.primary} />
            </G>
          )}

          {showRingMarker && (
            // Counter-rotate by the heading so the Kaaba stays upright while the ring turns.
            <G
              testID="kaaba-ring-marker"
              x={markerX - markerWidth / 2}
              y={markerY - markerHeight / 2}>
              <G
                rotation={heading}
                origin={`${markerWidth / 2}, ${markerHeight / 2}`}
                scale={MARKER_SCALE}>
                <KaabaShapes />
              </G>
            </G>
          )}
        </Svg>
      </Animated.View>
    </Box>
  );
};
