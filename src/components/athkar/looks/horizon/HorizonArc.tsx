import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { glowShadow, useHorizonInk } from "@/components/athkar/looks/horizon/ink";
import { Box } from "@/components/ui/box";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import {
  HORIZON_ARC,
  HORIZON_ARC_KIND,
  HORIZON_FOCUS_PATH,
  HORIZON_LINE,
  HORIZON_MOTION,
  HORIZON_READER_PATH,
  type HorizonArcKind,
} from "@/constants/AthkarHorizon";
import { MARK_SIZE, MARK_STATE } from "@/constants/AthkarSession";
import { useRTL } from "@/contexts/RTLContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { PositionMark } from "@/utils/athkarSession";
import {
  circleArc,
  litShare,
  markShares,
  quadCurve,
  type ArcCurve,
  type ArcPoint,
} from "@/utils/horizonArc";

/** Test ids for the arc's parts. */
export const HORIZON_ARC_PART = {
  LIT: "horizon-arc-lit",
  POINT: "horizon-arc-point",
  SUN: "horizon-arc-sun",
} as const;

const flip = (width: number, { x, y }: ArcPoint): ArcPoint => ({ x: width - x, y });

/** Each arc from the session's start: the right in Arabic, the left otherwise. */
const curves = (rtl: boolean): Record<HorizonArcKind, ArcCurve> => {
  const reader = HORIZON_ARC[HORIZON_ARC_KIND.READER].WIDTH;
  const focus = HORIZON_ARC[HORIZON_ARC_KIND.FOCUS].WIDTH;
  const side = (width: number, point: ArcPoint) => (rtl ? point : flip(width, point));
  return {
    [HORIZON_ARC_KIND.READER]: quadCurve(
      side(reader, HORIZON_READER_PATH.FROM),
      HORIZON_READER_PATH.CONTROL,
      side(reader, HORIZON_READER_PATH.TO)
    ),
    [HORIZON_ARC_KIND.FOCUS]: circleArc(
      HORIZON_FOCUS_PATH.CENTRE,
      HORIZON_FOCUS_PATH.RADIUS,
      side(focus, HORIZON_FOCUS_PATH.FROM),
      side(focus, HORIZON_FOCUS_PATH.TO)
    ),
  };
};
const CURVES = { rtl: curves(true), ltr: curves(false) } as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const travel = { duration: HORIZON_MOTION.TRAVEL_MS, easing: Easing.out(Easing.cubic) };

type Props = {
  kind: HorizonArcKind;
  marks: readonly PositionMark[];
  /** The current dhikr's count against its target, 0 to 1. */
  fraction: number;
};

/** A session on the sun's arc: a point for each dhikr, the sun on the current one. */
export const HorizonArc = ({ kind, marks, fraction }: Props) => {
  const { isRTL } = useRTL();
  const reduceMotion = useReducedMotion();
  const ink = useHorizonInk();
  const box = HORIZON_ARC[kind];
  const curve = CURVES[isRTL ? "rtl" : "ltr"][kind];

  const shares = markShares(marks);
  const current = marks.findIndex(({ state }) => state === MARK_STATE.CURRENT);
  const index = current < 0 ? null : current;
  const lit = litShare(shares, index, fraction);
  const sun = curve.pointAt(index === null ? (shares.at(-1) ?? 0) : shares[index]);

  const litNow = useSharedValue(lit);
  const sunX = useSharedValue(sun.x);
  const sunY = useSharedValue(sun.y);
  useEffect(() => {
    const to = (value: number) => (reduceMotion ? value : withTiming(value, travel));
    litNow.set(to(lit));
    sunX.set(to(sun.x));
    sunY.set(to(sun.y));
  }, [lit, sun.x, sun.y, reduceMotion, litNow, sunX, sunY]);

  const litProps = useAnimatedProps(() => ({
    strokeDashoffset: curve.length * (1 - litNow.get()),
  }));
  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sunX.get() - box.SUN / 2 }, { translateY: sunY.get() - box.SUN / 2 }],
  }));

  return (
    // Left to right always: the curve is drawn in the box's own x.
    <View
      {...HIDDEN_FROM_READER}
      pointerEvents="none"
      style={[styles.frame, { width: box.WIDTH, height: box.HEIGHT }]}>
      <Svg width={box.WIDTH} height={box.HEIGHT} viewBox={`0 0 ${box.WIDTH} ${box.HEIGHT}`}>
        <Path
          d={curve.d}
          fill="none"
          stroke={ink.fg}
          strokeWidth={HORIZON_LINE.TRACK.WIDTH}
          strokeOpacity={HORIZON_LINE.TRACK.OPACITY}
          strokeLinecap="round"
        />
        <AnimatedPath
          testID={HORIZON_ARC_PART.LIT}
          d={curve.d}
          fill="none"
          stroke={ink.light}
          strokeWidth={HORIZON_LINE.LIT.WIDTH}
          strokeLinecap="round"
          strokeDasharray={curve.length}
          animatedProps={litProps}
        />
        {marks.map((mark, i) => {
          if (i === index) return null;
          const { x, y } = curve.pointAt(shares[i]);
          const done = mark.state === MARK_STATE.DONE;
          const fine = mark.size === MARK_SIZE.FINE;
          return (
            <Circle
              key={mark.id}
              testID={HORIZON_ARC_PART.POINT}
              cx={x}
              cy={y}
              r={fine ? box.FINE : box.POINT}
              fill={done ? ink.light : fine ? ink.fg : ink.raised}
              fillOpacity={fine && !done ? HORIZON_LINE.FINE_OPACITY : 1}
              stroke={fine ? "none" : done ? ink.light : ink.fg}
              strokeWidth={HORIZON_LINE.POINT_STROKE}
            />
          );
        })}
      </Svg>
      <Animated.View testID={HORIZON_ARC_PART.SUN} style={[styles.sun, sunStyle]}>
        <Box
          width={box.SUN}
          height={box.SUN}
          borderRadius="$pill"
          style={{
            backgroundColor: ink.disc,
            boxShadow: glowShadow(ink.light, box.SUN_GLOW[ink.brightness]),
          }}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: { direction: "ltr" },
  sun: { position: "absolute", top: 0, left: 0 },
});
