import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { HorizonArc } from "@/components/athkar/looks/horizon/HorizonArc";
import { HorizonOrb } from "@/components/athkar/looks/horizon/HorizonOrb";
import { useHorizonInk } from "@/components/athkar/looks/horizon/ink";
import type { AthkarFocusProps } from "@/components/athkar/looks/types";
import { FocusCount } from "@/components/athkar/session/FocusCount";
import { FocusGestureMarks, FocusSideMarks } from "@/components/athkar/session/FocusHint";
import { FocusPager, FocusPlace, FocusSurface } from "@/components/athkar/session/FocusStage";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import {
  HORIZON_ARC_KIND,
  HORIZON_BLOOM,
  HORIZON_MOTION,
  HORIZON_ORB,
} from "@/constants/AthkarHorizon";
import { useFocusStage, type FocusStage } from "@/hooks/useFocusStage";
import { hexAlpha } from "@/utils/hexAlpha";

/** Test ids for the Focus stage's own parts. */
export const HORIZON_FOCUS_PART = {
  FIGURES: "horizon-focus-figures",
  BLOOM: "horizon-focus-bloom",
  DIGIT_SIZER: "horizon-focus-digit-sizer",
} as const;

const BLOOM_RADIUS = HORIZON_BLOOM.SIZE / 2;

/** The light a tap leaves: it opens from the finger and fades. */
const Bloom = ({ stage }: { stage: FocusStage }) => {
  const ink = useHorizonInk();
  const { taps, gesture } = stage;
  const { point } = gesture;
  const spread = useSharedValue(1);
  // Where the counted tap landed; a later touch moves `point` alone.
  const at = useSharedValue({ x: 0, y: 0 });
  // Taps counted before this mount draw nothing.
  const drawn = useRef(taps);
  useEffect(() => {
    if (taps === drawn.current) return;
    drawn.current = taps;
    at.set(point.get());
    spread.set(0);
    spread.set(
      withTiming(1, { duration: HORIZON_MOTION.BLOOM_MS, easing: Easing.out(Easing.cubic) })
    );
  }, [taps, spread, at, point]);
  const style = useAnimatedStyle(() => ({
    opacity: HORIZON_BLOOM.OPACITY * (1 - spread.get()),
    transform: [
      { translateX: at.get().x - BLOOM_RADIUS },
      { translateY: at.get().y - BLOOM_RADIUS },
      { scale: HORIZON_BLOOM.FROM_SCALE + (1 - HORIZON_BLOOM.FROM_SCALE) * spread.get() },
    ],
  }));
  const light = hexAlpha(ink.light, HORIZON_BLOOM.ALPHA[ink.brightness]);
  // Two equal radii: RN's parser drops the token after a lone size.
  const image = `radial-gradient(${BLOOM_RADIUS}px ${BLOOM_RADIUS}px at ${BLOOM_RADIUS}px ${BLOOM_RADIUS}px, ${light} 0%, ${hexAlpha(ink.light, 0)} ${HORIZON_BLOOM.CLEAR_AT * 100}%)`;
  return (
    // The finger's x counts from the left; RN swaps `left` in a RTL frame.
    <View style={styles.bloomFrame} pointerEvents="none">
      <Animated.View
        testID={HORIZON_FOCUS_PART.BLOOM}
        {...HIDDEN_FROM_READER}
        style={[styles.bloom, { experimental_backgroundImage: image }, style]}
      />
    </View>
  );
};

/** The Horizon look of Focus: the count is a sun that fills, on the open sky. */
export const HorizonFocus = ({ period, close, audio, ...rules }: AthkarFocusProps) => {
  const stage = useFocusStage(rules);
  if (!stage) return null;
  const { session, count, target, gesture } = stage;
  const fraction = target > 0 ? count / target : 0;

  return (
    <View style={styles.fill}>
      <HStack alignItems="center" paddingHorizontal="$3.5">
        {audio}
        <Text flex={1} size="label" fontWeight="600" color="$mutedSky" textAlign="center">
          {period}
        </Text>
        {close}
      </HStack>
      <FocusSurface stage={stage}>
        {!stage.reduceMotion && <Bloom stage={stage} />}
        <FocusPlace stage={stage} testID={HORIZON_FOCUS_PART.FIGURES} style={styles.figures}>
          <Text size="label" fontWeight="500" color="$mutedSky" numeric>
            {stage.figures}
          </Text>
        </FocusPlace>
        <View style={styles.orb}>
          <FocusPlace stage={stage} style={styles.arc}>
            <HorizonArc kind={HORIZON_ARC_KIND.FOCUS} marks={session.marks} fraction={fraction} />
          </FocusPlace>
          {/* Keyed: a new dhikr opens on a new sun, with nothing to take back. */}
          <HorizonOrb
            key={session.current?.item.id}
            fraction={fraction}
            hold={gesture.hold}
            reduceMotion={stage.reduceMotion}
          />
        </View>
        <Box minHeight="$6" paddingHorizontal="$5">
          {stage.hinting && <FocusSideMarks visible={stage.hintVisible} />}
        </Box>

        <FocusPager stage={stage} />

        <VStack alignItems="center" paddingHorizontal="$5" paddingBottom="$8">
          <FocusCount stage={stage} digitTestID={HORIZON_FOCUS_PART.DIGIT_SIZER} />
          <Box minHeight="$6" marginTop="$3" justifyContent="center">
            {stage.statusLine !== null ? (
              <Text size="md" fontWeight="500" color="$mutedSky" textAlign="center">
                {stage.statusLine}
              </Text>
            ) : (
              stage.hinting && <FocusGestureMarks visible={stage.hintVisible} />
            )}
          </Box>
        </VStack>
      </FocusSurface>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  orb: {
    alignSelf: "center",
    width: HORIZON_ORB.SIZE,
    height: HORIZON_ORB.SIZE,
    marginTop: HORIZON_ORB.ARC_GAP,
  },
  arc: { position: "absolute", top: -HORIZON_ORB.ARC_GAP, left: -HORIZON_ORB.ARC_GAP },
  figures: { position: "absolute", top: 0, start: 20 },
  bloomFrame: { ...StyleSheet.absoluteFill, direction: "ltr" },
  bloom: {
    position: "absolute",
    top: 0,
    left: 0,
    width: HORIZON_BLOOM.SIZE,
    height: HORIZON_BLOOM.SIZE,
  },
});
