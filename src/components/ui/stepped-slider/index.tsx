import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { A11Y_ACTION, adjustActions, HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { DURATION_MS } from "@/constants/Motion";
import { useRTL } from "@/contexts/RTLContext";
import { useHaptic } from "@/hooks/useHaptic";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids for the parts that move or take touches. */
export const STEPPED_SLIDER_PART = {
  TOUCH: "stepped-slider-touch",
  TRACK: "stepped-slider-track",
  DOT: "stepped-slider-dot",
  FILL: "stepped-slider-fill",
  THUMB: "stepped-slider-thumb",
} as const;

/** Test ids for the two gestures, for Gesture Handler's jest utils. */
export const STEPPED_SLIDER_GESTURE = {
  PAN: "stepped-slider-pan",
  TAP: "stepped-slider-tap",
} as const;

const GEOMETRY = { hit: 44, track: 4, dot: 8, thumb: 24 } as const;
// A drag starts sideways; a vertical move first hands the touch to the page.
const PAN = { startAt: 8, failAt: 12 } as const;

const GLIDE = { duration: DURATION_MS.QUICK, reduceMotion: ReduceMotion.Never };

/** A stop's centre, from the reading start of a track `width` wide. */
export const stopOffset = (index: number, width: number, count: number): number =>
  GEOMETRY.thumb / 2 + (count > 1 ? (index * (width - GEOMETRY.thumb)) / (count - 1) : 0);

/** The stop nearest a touch `x` points from the track's left edge. */
export const stopIndexAt = (x: number, width: number, count: number, isRTL: boolean): number => {
  const span = width - GEOMETRY.thumb;
  if (count < 2 || span <= 0) return 0;
  const along = (isRTL ? width - x : x) - GEOMETRY.thumb / 2;
  return Math.min(count - 1, Math.max(0, Math.round((along / span) * (count - 1))));
};

export type SteppedSliderProps<V extends string | number> = {
  /** The stops in reading order: the `as const` list itself. */
  stops: readonly V[];
  value: V;
  /** Once per release, tap or screen-reader step that lands on another stop. */
  onChange: (value: V) => void;
  /** Each stop a drag crosses, in order, even those one move skips over;
   * the committed stop if the drag is cancelled. */
  onDraft?: (value: V) => void;
  /** A stop as spoken. */
  formatValue: (value: V) => string;
  accessibilityLabel: string;
  /** Beside the track at the reading start and end; decorative. */
  startMark?: ReactNode;
  endMark?: ReactNode;
  /** The text under a stop; undefined leaves that stop bare. */
  stopLabel?: (value: V) => string | undefined;
};

/** A track of discrete stops: drag, tap or step with a screen reader. */
export const SteppedSlider = <V extends string | number>({
  stops,
  value,
  onChange,
  onDraft,
  formatValue,
  accessibilityLabel,
  startMark,
  endMark,
  stopLabel,
}: SteppedSliderProps<V>) => {
  const { isRTL, direction } = useRTL();
  const reduced = useReducedMotion();
  const tick = useHaptic("selection");
  const [width, setWidth] = useState(0);
  // The stop under a drag, drawn while the finger is down.
  const [dragged, setDragged] = useState<number | null>(null);

  const count = stops.length;
  const committed = Math.max(0, stops.indexOf(value));
  const shown = dragged ?? committed;
  const target = stopOffset(shown, width, count);

  const thumb = useSharedValue(target);
  // The width the thumb was placed for; a new width places it, no glide.
  const placedFor = useRef<number | null>(null);
  useEffect(() => {
    if (reduced || placedFor.current !== width) {
      placedFor.current = width;
      thumb.set(target);
      return;
    }
    thumb.set(withTiming(target, GLIDE));
  }, [target, width, reduced, thumb]);

  const thumbStyle = useAnimatedStyle(() => ({ start: thumb.get() - GEOMETRY.thumb / 2 }));
  const fillStyle = useAnimatedStyle(() => ({ width: thumb.get() - GEOMETRY.thumb / 2 }));

  const indexAt = (x: number) => stopIndexAt(x, width, count, isRTL);

  const jump = (next: number) => {
    if (next === committed) return;
    void tick();
    onChange(stops[next]);
  };

  // Handlers fire faster than renders, so each reads its stops from the event.
  // A fast move can skip stops; each one between still ticks and drafts.
  const draftAt = (next: number, from: number) => {
    if (next === from) return;
    const step = next > from ? 1 : -1;
    for (let index = from + step; index !== next + step; index += step) {
      void tick();
      onDraft?.(stops[index]);
    }
    setDragged(next);
  };

  const finishAt = (last: number, landed: boolean) => {
    setDragged(null);
    if (last === committed) return;
    if (landed) onChange(stops[last]);
    else onDraft?.(value);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .withTestId(STEPPED_SLIDER_GESTURE.PAN)
    .activeOffsetX([-PAN.startAt, PAN.startAt])
    .failOffsetY([-PAN.failAt, PAN.failAt])
    .onStart(({ x }) => draftAt(indexAt(x), committed))
    .onChange(({ x, changeX }) => draftAt(indexAt(x), indexAt(x - changeX)))
    .onEnd(({ x }, success) => finishAt(indexAt(x), success));
  const tap = Gesture.Tap()
    .runOnJS(true)
    .withTestId(STEPPED_SLIDER_GESTURE.TAP)
    .onEnd(({ x }, success) => {
      if (success) jump(indexAt(x));
    });

  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === A11Y_ACTION.INCREMENT) jump(Math.min(count - 1, committed + 1));
    if (nativeEvent.actionName === A11Y_ACTION.DECREMENT) jump(Math.max(0, committed - 1));
  };

  // Columns one stop apart, each centred on its stop, past the track ends.
  const column = count > 1 ? (width - GEOMETRY.thumb) / (count - 1) : width;

  return (
    <VStack
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: count - 1, now: committed, text: formatValue(value) }}
      accessibilityActions={adjustActions()}
      onAccessibilityAction={handleAccessibilityAction}
      // Set here too, so a host in another direction still mirrors the track.
      style={{ direction }}>
      <HStack {...HIDDEN_FROM_READER} alignItems="flex-start" gap="$2.5">
        <View style={styles.mark}>{startMark}</View>
        {/* Labels take touches too; both rows share the track's x. */}
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
          <View testID={STEPPED_SLIDER_PART.TOUCH} style={styles.touch}>
            <View
              testID={STEPPED_SLIDER_PART.TRACK}
              style={styles.track}
              onLayout={({ nativeEvent }: LayoutChangeEvent) => setWidth(nativeEvent.layout.width)}>
              <Box style={styles.line} backgroundColor="$track" borderRadius="$pill" />
              <Animated.View testID={STEPPED_SLIDER_PART.FILL} style={[styles.fill, fillStyle]}>
                <Box flex={1} backgroundColor="$accent" borderRadius="$pill" />
              </Animated.View>
              {stops.map((stop, index) => (
                <Box
                  key={stop}
                  testID={STEPPED_SLIDER_PART.DOT}
                  style={[
                    styles.dot,
                    { start: stopOffset(index, width, count) - GEOMETRY.dot / 2 },
                  ]}
                  backgroundColor={index <= shown ? "$accent" : "$mutedSky"}
                  borderRadius="$pill"
                />
              ))}
              <Animated.View testID={STEPPED_SLIDER_PART.THUMB} style={[styles.thumb, thumbStyle]}>
                <Box
                  flex={1}
                  backgroundColor="$thumb"
                  borderWidth={1}
                  borderColor="$accentEdge"
                  borderRadius="$pill"
                />
              </Animated.View>
            </View>
            {stopLabel && width > 0 ? (
              <HStack marginHorizontal={(GEOMETRY.thumb - column) / 2}>
                {stops.map((stop, index) => (
                  <Text
                    key={stop}
                    width={column}
                    size="xs"
                    typography="helper"
                    textAlign="center"
                    fontWeight={index === shown ? "700" : "600"}
                    color={index === shown ? "$fg" : "$mutedSky"}>
                    {stopLabel(stop) ?? ""}
                  </Text>
                ))}
              </HStack>
            ) : null}
          </View>
        </GestureDetector>
        <View style={styles.mark}>{endMark}</View>
      </HStack>
    </VStack>
  );
};

const centredOn = (height: number) => ({
  position: "absolute" as const,
  top: (GEOMETRY.hit - height) / 2,
  height,
});

const styles = StyleSheet.create({
  mark: { height: GEOMETRY.hit, justifyContent: "center" },
  touch: { flex: 1 },
  track: { height: GEOMETRY.hit },
  line: {
    ...centredOn(GEOMETRY.track),
    start: GEOMETRY.thumb / 2,
    end: GEOMETRY.thumb / 2,
  },
  fill: { ...centredOn(GEOMETRY.track), start: GEOMETRY.thumb / 2 },
  dot: { ...centredOn(GEOMETRY.dot), width: GEOMETRY.dot },
  thumb: { ...centredOn(GEOMETRY.thumb), width: GEOMETRY.thumb },
});
