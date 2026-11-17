import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useSubhaInk } from "@/components/athkar/looks/subha/ink";
import { Box } from "@/components/ui/box";
import { Material, MATERIAL } from "@/components/ui/material";
import { useThemeColor } from "@/components/ui/theme-color";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { SUBHA_MOTION, SUBHA_SLAB } from "@/constants/AthkarSubha";
import { useReduceTransparency } from "@/hooks/useReduceTransparency";
import { hexAlpha } from "@/utils/hexAlpha";

/** Test ids for the slab's parts. */
export const SUBHA_SLAB_PART = {
  FRONT: "subha-slab-front",
  BEHIND: "subha-slab-behind",
} as const;

const [NEXT] = SUBHA_SLAB.BEHIND;
const rise = { duration: SUBHA_MOTION.RISE_MS, easing: Easing.bezier(...SUBHA_MOTION.CURVE) };
const jump = { duration: 0 };

type RimProps = ComponentProps<typeof VStack> & { solid: boolean };

/** The slab's rim: a thin pane of the surface round the glass. */
const Rim = ({ solid, ...props }: RimProps) => {
  const ink = useSubhaInk();
  const highlight = useThemeColor("$highlight");
  return (
    <VStack
      flexShrink={1}
      padding="$1.5"
      borderRadius="$hero"
      {...props}
      style={
        solid
          ? undefined
          : {
              backgroundColor: hexAlpha(ink.surface, SUBHA_SLAB.RIM_ALPHA),
              boxShadow: `inset 0 1px 0 ${highlight}`,
            }
      }
    />
  );
};

type SubhaStackProps = {
  /** The current dhikr; a new one rises from the slab behind. */
  itemId: string;
  /** Unfinished dhikr after this one; up to two show as slabs behind. */
  waiting: number;
  reduceMotion: boolean;
  children: ReactNode;
};

/** The dhikr on a glass slab, the ones still to come stacked behind it. */
export const SubhaStack = ({ itemId, waiting, reduceMotion, children }: SubhaStackProps) => {
  const solid = useReduceTransparency();
  const behind = solid ? [] : SUBHA_SLAB.BEHIND.slice(0, waiting);
  const ink = useSubhaInk();
  // The slab stays mounted, so a screen reader keeps its place in it.
  const shift = useSharedValue(0);
  const shown = useRef(itemId);
  useEffect(() => {
    if (shown.current === itemId) return;
    shown.current = itemId;
    if (reduceMotion) return;
    shift.set(withSequence(withTiming(1, jump), withTiming(0, rise)));
  }, [itemId, reduceMotion, shift]);
  // Transform alone: opacity below 1 over a blur stops it blurring.
  const risen = useAnimatedStyle(() => ({
    transform: [
      { translateY: -NEXT.RISE * shift.get() },
      { scale: 1 - (1 - NEXT.SCALE) * shift.get() },
    ],
  }));
  return (
    <View style={styles.stack}>
      <View style={styles.slabs}>
        {behind.map(({ RISE, SCALE, OPACITY }, depth) => (
          <View
            key={RISE}
            testID={SUBHA_SLAB_PART.BEHIND}
            {...HIDDEN_FROM_READER}
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { zIndex: -depth - 1 },
              { transform: [{ translateY: -RISE }, { scale: SCALE }] },
            ]}>
            {/* Tint alone: a fading blur stops blurring. */}
            <Box
              flex={1}
              padding="$1.5"
              borderRadius="$hero"
              style={{ backgroundColor: hexAlpha(ink.surface, SUBHA_SLAB.RIM_ALPHA * OPACITY) }}>
              <Box flex={1} borderRadius="$sheet" style={{ backgroundColor: ink.glass(OPACITY) }} />
            </Box>
          </View>
        ))}
        <Animated.View testID={SUBHA_SLAB_PART.FRONT} style={[styles.front, risen]}>
          <Rim solid={solid}>
            <Material
              material={MATERIAL.GLASS}
              radius="$sheet"
              flexShrink={1}
              paddingTop="$6"
              paddingHorizontal="$5"
              paddingBottom="$4">
              {children}
            </Material>
          </Rim>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { flex: 1, justifyContent: "center", paddingTop: SUBHA_SLAB.STACK_TOP },
  slabs: { flexShrink: 1 },
  front: { flexShrink: 1 },
});
