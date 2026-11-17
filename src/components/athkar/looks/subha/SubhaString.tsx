import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useSubhaInk } from "@/components/athkar/looks/subha/ink";
import { Box } from "@/components/ui/box";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import {
  SUBHA_BEADS,
  SUBHA_MOTION,
  SUBHA_STRING,
  type SubhaStringKind,
} from "@/constants/AthkarSubha";
import { useRTL } from "@/contexts/RTLContext";
import {
  BEAD_MOVE,
  beadMove,
  beadPoint,
  beadsAcross,
  beadsOn,
  stringPath,
} from "@/utils/subhaBeads";

/** Test ids for the string's parts. */
export const SUBHA_STRING_PART = {
  STRING: "subha-string",
  BEAD: "subha-string-bead",
} as const;

const travel = { duration: SUBHA_MOTION.BEAD_MS, easing: Easing.bezier(...SUBHA_MOTION.CURVE) };
const fade = { duration: SUBHA_MOTION.OPACITY_MS };
const jump = { duration: 0 };

type Drawing = (typeof SUBHA_STRING)[SubhaStringKind];

type BeadProps = {
  index: number;
  count: number;
  target: number;
  drawing: Drawing;
  rtl: boolean;
  reduceMotion: boolean;
};

const opacityOf = (index: number, across: number) =>
  index < across ? 1 : SUBHA_BEADS.WAITING_OPACITY;

/** One bead: it slides to its place on the string and lights once counted. */
const Bead = ({ index, count, target, drawing, rtl, reduceMotion }: BeadProps) => {
  const ink = useSubhaInk();
  const beads = beadsOn(target);
  const across = beadsAcross(count, target);
  const at = beadPoint(index, across, beads, drawing, rtl);
  const x = useSharedValue(at.x);
  const y = useSharedValue(at.y);
  const opacity = useSharedValue(opacityOf(index, across));
  const last = useRef<number | null>(null);
  useEffect(() => {
    const point = beadPoint(index, across, beads, drawing, rtl);
    const lit = opacityOf(index, across);
    const full = beadPoint(index, beads, beads, drawing, rtl);
    const move = reduceMotion ? BEAD_MOVE.PLACE : beadMove(last.current, count, target);
    last.current = count;
    switch (move) {
      case BEAD_MOVE.PLACE:
        x.set(point.x);
        y.set(point.y);
        opacity.set(lit);
        return;
      case BEAD_MOVE.SWEEP:
        x.set(withSequence(withTiming(full.x, travel), withTiming(point.x, travel)));
        y.set(withSequence(withTiming(full.y, travel), withTiming(point.y, travel)));
        opacity.set(withSequence(withTiming(1, fade), withTiming(lit, fade)));
        return;
      case BEAD_MOVE.UNWIND:
        x.set(withSequence(withTiming(full.x, jump), withTiming(point.x, travel)));
        y.set(withSequence(withTiming(full.y, jump), withTiming(point.y, travel)));
        opacity.set(withSequence(withTiming(1, jump), withTiming(lit, fade)));
        return;
      case BEAD_MOVE.SLIDE:
        x.set(withTiming(point.x, travel));
        y.set(withTiming(point.y, travel));
        opacity.set(withTiming(lit, fade));
        return;
    }
  }, [index, count, target, across, beads, drawing, rtl, reduceMotion, x, y, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));
  return (
    <Animated.View
      testID={SUBHA_STRING_PART.BEAD}
      style={[styles.bead, { width: drawing.BEAD, height: drawing.BEAD }, style]}>
      <Box
        flex={1}
        borderRadius="$pill"
        style={{
          experimental_backgroundImage: ink.bead(drawing.BEAD),
          boxShadow: ink.beadShadow,
        }}
      />
    </Animated.View>
  );
};

type SubhaStringProps = {
  kind: SubhaStringKind;
  count: number;
  target: number;
  reduceMotion: boolean;
  /** 0 to 1 as a hold builds; the string gives under it. */
  hold?: SharedValue<number>;
};

/** The count as beads: each repeat slides one across the string. */
export const SubhaString = ({ kind, count, target, reduceMotion, hold }: SubhaStringProps) => {
  const ink = useSubhaInk();
  const { isRTL } = useRTL();
  const drawing = SUBHA_STRING[kind];
  const beads = beadsOn(target);

  // The string dips once as the count reaches its target.
  const dip = useSharedValue(0);
  const reached = target > 0 && count >= target;
  const wasReached = useRef(reached);
  useEffect(() => {
    const before = wasReached.current;
    wasReached.current = reached;
    if (!reached || before || reduceMotion) return;
    const half = { duration: SUBHA_MOTION.SETTLE_MS / 2 };
    dip.set(withSequence(withTiming(SUBHA_MOTION.SETTLE_DIP, half), withTiming(0, half)));
  }, [reached, reduceMotion, dip]);

  const give = useAnimatedStyle(() => ({
    transform: [
      { translateY: dip.get() + (reduceMotion || !hold ? 0 : hold.get() * SUBHA_MOTION.HOLD_SAG) },
    ],
  }));

  return (
    <Animated.View
      testID={SUBHA_STRING_PART.STRING}
      {...HIDDEN_FROM_READER}
      pointerEvents="none"
      style={[styles.box, { width: drawing.WIDTH, height: drawing.BEAD + drawing.SAG }, give]}>
      <Svg
        width={drawing.WIDTH}
        height={drawing.BEAD + drawing.SAG}
        style={StyleSheet.absoluteFill}>
        <Path
          d={stringPath(drawing)}
          stroke={ink.fg}
          strokeWidth={SUBHA_BEADS.LINE.WIDTH}
          strokeOpacity={SUBHA_BEADS.LINE.OPACITY}
          fill="none"
        />
      </Svg>
      {Array.from({ length: beads }, (_, index) => (
        <Bead
          key={index}
          index={index}
          count={count}
          target={target}
          drawing={drawing}
          rtl={isRTL}
          reduceMotion={reduceMotion}
        />
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Drawn left to right; each bead's x already reads the language's side.
  box: { alignSelf: "center", direction: "ltr" },
  bead: { position: "absolute", top: 0, left: 0 },
});
