import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { glowShadow, useHorizonInk } from "@/components/athkar/looks/horizon/ink";
import { Box } from "@/components/ui/box";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { HORIZON_MOTION, HORIZON_ORB } from "@/constants/AthkarHorizon";
import { hexAlpha } from "@/utils/hexAlpha";

/** Test ids for the orb's parts. */
export const HORIZON_ORB_PART = {
  DISC: "horizon-orb-disc",
  RING: "horizon-orb-ring",
  HALO: "horizon-orb-halo",
  SHED: "horizon-orb-shed",
} as const;

const { SIZE, MIN_SCALE, RING, HALO, SHED } = HORIZON_ORB;
const ease = Easing.out(Easing.cubic);

const scaleAt = (fraction: number) =>
  MIN_SCALE + (1 - MIN_SCALE) * Math.min(Math.max(fraction, 0), 1);

type Props = {
  /** The count against its target, 0 to 1. */
  fraction: number;
  /** 0 to 1 as a hold builds. */
  hold: SharedValue<number>;
  reduceMotion: boolean;
};

/** The count as a sun: a disc that grows inside its ring until it fills it. */
export const HorizonOrb = ({ fraction, hold, reduceMotion }: Props) => {
  const ink = useHorizonInk();
  const whole = fraction >= 1;
  const goal = scaleAt(fraction);

  const scale = useSharedValue(goal);
  const shed = useSharedValue(1);
  const shedFrom = useSharedValue(goal);
  const last = useRef(goal);
  useEffect(() => {
    const before = last.current;
    last.current = goal;
    scale.set(
      reduceMotion ? goal : withTiming(goal, { duration: HORIZON_MOTION.FILL_MS, easing: ease })
    );
    // A repeat taken back leaves a sliver that drifts off the disc.
    if (goal >= before || reduceMotion) return;
    shedFrom.set(before);
    shed.set(0);
    shed.set(withTiming(1, { duration: HORIZON_MOTION.SHED_MS, easing: ease }));
  }, [goal, reduceMotion, scale, shed, shedFrom]);

  const discStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: Math.min(hold.get() / HALO.EASE_UNTIL, 1) * hold.get(),
  }));
  const shedStyle = useAnimatedStyle(() => ({
    opacity: SHED.OPACITY * (1 - shed.get()),
    transform: [{ scale: shedFrom.get() + SHED.GROW * shed.get() }],
  }));

  return (
    <View {...HIDDEN_FROM_READER} pointerEvents="none" style={styles.box}>
      <Animated.View testID={HORIZON_ORB_PART.HALO} style={[StyleSheet.absoluteFill, haloStyle]}>
        <Box
          flex={1}
          borderRadius="$pill"
          style={{
            boxShadow: [
              `0 0 0 ${HALO.RING}px ${hexAlpha(ink.light, HALO.RING_ALPHA[ink.brightness])}`,
              glowShadow(ink.light, HALO.GLOW[ink.brightness]),
            ].join(", "),
          }}
        />
      </Animated.View>
      {/* The ring is the room left to fill; a whole disc has none. */}
      <Box
        testID={HORIZON_ORB_PART.RING}
        position="absolute"
        inset={0}
        borderRadius="$pill"
        borderWidth={RING.WIDTH}
        opacity={whole ? 0 : 1}
        style={{ borderColor: hexAlpha(ink.disc, RING.ALPHA[ink.brightness]) }}
      />
      <Animated.View testID={HORIZON_ORB_PART.DISC} style={[StyleSheet.absoluteFill, discStyle]}>
        <Box
          flex={1}
          borderRadius="$pill"
          style={{
            backgroundColor: ink.disc,
            boxShadow: glowShadow(
              ink.light,
              (whole ? HORIZON_ORB.REST_GLOW : HORIZON_ORB.GLOW)[ink.brightness]
            ),
          }}
        />
      </Animated.View>
      <Animated.View testID={HORIZON_ORB_PART.SHED} style={[StyleSheet.absoluteFill, shedStyle]}>
        <Box
          flex={1}
          borderRadius="$pill"
          borderWidth={SHED.WIDTH}
          style={{ borderColor: hexAlpha(ink.light, SHED.ALPHA[ink.brightness]) }}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({ box: { width: SIZE, height: SIZE } });
