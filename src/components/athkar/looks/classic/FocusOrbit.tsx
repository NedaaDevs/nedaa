import { StyleSheet } from "react-native";
import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { CountFigure } from "@/components/athkar/looks/classic/CountFigure";
import { useCountDrag } from "@/components/athkar/session/FocusStage";
import { Box } from "@/components/ui/box";
import { type DigitTextProps } from "@/components/ui/digit-reserve";
import { HighlightEdge, useElevationShadow } from "@/components/ui/material/edge";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/components/ui/theme-color";
import { FOCUS_MOTION } from "@/constants/AthkarFocus";
import { ELEVATION_LEVEL } from "@/constants/Elevation";

/** Test ids for the orbit's parts. */
export const FOCUS_ORBIT_PART = {
  ORBIT: "focus-orbit",
  DIGIT_SIZER: "focus-orbit-digit-sizer",
} as const;

/** The disc, and its rings in a 120-unit box: the count's, then the hold's. */
const DIAMETER = 196;
const BOX = 120;
const COUNT_RING = { radius: 54, stroke: 3.2 } as const;
const HOLD_RING = { radius: 58.6, stroke: 1.6 } as const;
const HOLD_LENGTH = 2 * Math.PI * HOLD_RING.radius;
const COUNT_LENGTH = 2 * Math.PI * COUNT_RING.radius;

const NUMBER: DigitTextProps = {
  fontSize: 56,
  lineHeight: 64,
  fontWeight: "600",
  color: "$fg",
  numeric: true,
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  count: number;
  target: number;
  /** The count and the target as written, in the reader's digits. */
  countText: string;
  targetText: string;
  /** The line under the number, such as "of 33". */
  targetLine: string;
  /** What a release would add or take, such as "+10"; null draws none. */
  change: string | null;
  /** A release would undo: the number dims. */
  armed: boolean;
  canUndo: boolean;
  reduceMotion: boolean;
  /** 0 to 1 as a hold builds. */
  hold: SharedValue<number>;
  /** The side drag's distance: the orbit fades as the text moves. */
  side: SharedValue<number>;
  /** The downward drag's distance: the orbit sinks under it. */
  down: SharedValue<number>;
};

/** The count of the current dhikr, in the ring that fills toward its target. */
export const FocusOrbit = ({
  count,
  target,
  countText,
  targetText,
  targetLine,
  change,
  armed,
  canUndo,
  reduceMotion,
  hold,
  side,
  down,
}: Props) => {
  const lift = useElevationShadow(ELEVATION_LEVEL.E2);
  const track = useThemeColor("$track");
  const accent = useThemeColor("$accent");
  const fraction = target > 0 ? Math.min(count / target, 1) : 0;
  const moved = useCountDrag({ side, down, canUndo, reduceMotion });
  const holdRing = useAnimatedProps(() => ({
    strokeDashoffset: HOLD_LENGTH * (1 - hold.get()),
  }));

  return (
    <Animated.View testID={FOCUS_ORBIT_PART.ORBIT} style={moved}>
      <Box
        width={DIAMETER}
        height={DIAMETER}
        alignItems="center"
        justifyContent="center"
        borderRadius="$pill"
        backgroundColor="$raised"
        style={{ boxShadow: lift }}>
        <HighlightEdge owner={FOCUS_ORBIT_PART.ORBIT} radius="$pill" />
        <Svg
          width={DIAMETER}
          height={DIAMETER}
          viewBox={`0 0 ${BOX} ${BOX}`}
          style={[StyleSheet.absoluteFill, styles.fromTop]}>
          <Circle
            cx={BOX / 2}
            cy={BOX / 2}
            r={COUNT_RING.radius}
            stroke={track}
            strokeWidth={COUNT_RING.stroke}
            fill="none"
          />
          <Circle
            cx={BOX / 2}
            cy={BOX / 2}
            r={COUNT_RING.radius}
            stroke={accent}
            strokeWidth={COUNT_RING.stroke}
            fill="none"
            strokeDasharray={COUNT_LENGTH}
            strokeDashoffset={COUNT_LENGTH * (1 - fraction)}
            strokeLinecap="round"
          />
          <AnimatedCircle
            cx={BOX / 2}
            cy={BOX / 2}
            r={HOLD_RING.radius}
            stroke={accent}
            strokeWidth={HOLD_RING.stroke}
            fill="none"
            strokeDasharray={HOLD_LENGTH}
            strokeLinecap="round"
            animatedProps={holdRing}
          />
        </Svg>
        <Box minHeight="$6" justifyContent="flex-end">
          {change !== null && (
            <Text size="label" fontWeight="600" color="$muted" numeric>
              {change}
            </Text>
          )}
        </Box>
        <CountFigure
          countText={countText}
          targetText={targetText}
          textProps={NUMBER}
          opacity={armed ? FOCUS_MOTION.ARMED_OPACITY : 1}
          digitTestID={FOCUS_ORBIT_PART.DIGIT_SIZER}
        />
        <Box minHeight="$6">
          <Text size="label" fontWeight="500" color="$muted" numeric>
            {targetLine}
          </Text>
        </Box>
      </Box>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // A stroke starts at three o'clock; the rings fill from the top.
  fromTop: { transform: [{ rotate: "-90deg" }] },
});
