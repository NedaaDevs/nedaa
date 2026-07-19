import { useEffect, useMemo, useRef } from "react";
import { useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Circle, G, Line, Rect, Svg, Text as SvgText } from "react-native-svg";
import { useTheme } from "tamagui";

import { Box } from "@/components/ui/box";
import type { QiblaProximityState } from "@/utils/compass";
import { unwrapHeading } from "@/utils/compass";
import { reshapeArabic } from "@/utils/reshaper";

const VIEWBOX_SIZE = 300;
const CENTER = VIEWBOX_SIZE / 2;
const RADIUS = 110;
const LETTER_DISTANCE = RADIUS - 20;

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
};

export const CompassDial = ({
  heading,
  qiblaDirection,
  proximityState,
  reduceMotion,
  accessibilityLabel,
  translateDirection,
}: CompassDialProps) => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const dialSize = Math.min(VIEWBOX_SIZE, Math.max(200, width - 64));
  const rotationValue = useSharedValue(-heading);
  const unwrappedHeading = useRef(heading);
  const ringPulse = useSharedValue(1);
  const isAligned = proximityState === "aligned";

  const colors = useMemo(
    () => ({
      primary: theme.primary.val,
      secondary: theme.typographySecondary.val,
      contrast: theme.typographyContrast.val,
      north: theme.error.val,
    }),
    [theme]
  );

  useEffect(() => {
    const nextHeading = unwrapHeading(unwrappedHeading.current, heading);
    unwrappedHeading.current = nextHeading;
    rotationValue.value = withTiming(-nextHeading, { duration: reduceMotion ? 0 : 150 });
  }, [heading, reduceMotion, rotationValue]);

  useEffect(() => {
    if (isAligned && !reduceMotion) {
      ringPulse.value = withRepeat(
        withSequence(withTiming(0.35, { duration: 900 }), withTiming(0.85, { duration: 900 })),
        -1,
        true
      );
    } else {
      ringPulse.value = withTiming(0, { duration: reduceMotion ? 0 : 200 });
    }
  }, [isAligned, reduceMotion, ringPulse]);

  const compassRotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationValue.value}deg` }],
  }));
  const ringPulseStyle = useAnimatedStyle(() => ({ opacity: ringPulse.value }));

  const qiblaDotRadius =
    proximityState === "aligned" ? 18 : proximityState === "approaching" ? 16 : 14;
  const ringColor = proximityState === "searching" ? colors.secondary : colors.primary;
  const ringOpacity = proximityState === "approaching" ? 0.65 : 1;
  const qiblaX =
    qiblaDirection === null
      ? 0
      : CENTER + Math.sin((qiblaDirection * Math.PI) / 180) * (RADIUS + 15);
  const qiblaY =
    qiblaDirection === null
      ? 0
      : CENTER - Math.cos((qiblaDirection * Math.PI) / 180) * (RADIUS + 15);

  const cardinals = [
    {
      key: "N",
      x: CENTER,
      y: CENTER - LETTER_DISTANCE,
      anchor: "middle" as const,
      color: colors.north,
      fontSize: 18,
    },
    {
      key: "S",
      x: CENTER,
      y: CENTER + LETTER_DISTANCE,
      anchor: "middle" as const,
      color: colors.secondary,
      fontSize: 16,
    },
    {
      key: "E",
      x: CENTER + LETTER_DISTANCE + 5,
      y: CENTER + 5,
      anchor: "end" as const,
      color: colors.secondary,
      fontSize: 16,
    },
    {
      key: "W",
      x: CENTER - LETTER_DISTANCE - 5,
      y: CENTER + 5,
      anchor: "start" as const,
      color: colors.secondary,
      fontSize: 16,
    },
  ];

  return (
    <Box
      width={dialSize}
      height={dialSize + 14}
      alignItems="center"
      justifyContent="flex-end"
      accessible
      accessibilityLabel={accessibilityLabel}>
      <Animated.View
        pointerEvents="none"
        style={[
          ringPulseStyle,
          {
            position: "absolute",
            bottom: 0,
            width: dialSize,
            height: dialSize,
            borderRadius: dialSize / 2,
            borderWidth: 3,
            borderColor: colors.primary,
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
            opacity={ringOpacity}
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
              textAnchor={direction.anchor}
              alignmentBaseline="middle"
              fontSize={direction.fontSize}
              fontWeight="bold"
              fontFamily="IBMPlexSans-Regular"
              fill={direction.color}>
              {reshapeArabic(translateDirection(`compass.directions.${direction.key}`))}
            </SvgText>
          ))}

          <Line
            x1={CENTER}
            y1={CENTER - 20}
            x2={CENTER}
            y2={CENTER + 20}
            stroke={colors.secondary}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.4}
          />
          <Line
            x1={CENTER - 20}
            y1={CENTER}
            x2={CENTER + 20}
            y2={CENTER}
            stroke={colors.secondary}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.4}
          />

          {qiblaDirection !== null && (
            <G>
              <Circle cx={qiblaX} cy={qiblaY} r={qiblaDotRadius} fill={colors.primary} />
              <G rotation={45} origin={`${qiblaX}, ${qiblaY}`}>
                <Rect x={qiblaX - 6} y={qiblaY - 6} width={12} height={12} fill={colors.contrast} />
              </G>
            </G>
          )}
        </Svg>
      </Animated.View>
    </Box>
  );
};
