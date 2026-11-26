import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, ScrollView, type PanGesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import { Box } from "@/components/ui/box";
import { SpokenStatus } from "@/components/ui/live-region";
import { FOCUS_MOTION, STEP } from "@/constants/AthkarFocus";
import { DURATION_MS } from "@/constants/Motion";
import type { FocusStage } from "@/hooks/useFocusStage";
import { textAt } from "@/utils/athkarSession";
import type { DhikrText } from "@/utils/athkarText";
import { slotX } from "@/utils/focusGesture";

/** Test ids for the parts every look's Focus stage shares. */
export const FOCUS_STAGE_PART = {
  SURFACE: "focus-stage-surface",
  PLACE: "focus-stage-place",
  PAGER: "focus-stage-pager",
  ROW: "focus-stage-row",
  TEXT: "focus-stage-text",
  TEXT_SCROLL: "focus-stage-text-scroll",
} as const;

/** The dhikr on each side of the place stays drawn, so a drag shows it. */
const NEIGHBOURS = [STEP.PREVIOUS, 0, STEP.NEXT] as const;

type StageProps = { stage: FocusStage };
type SurfaceProps = StageProps & { children: ReactNode };

/** The whole stage as one touch target, and what it says as it changes. */
export const FocusSurface = ({ stage, children }: SurfaceProps) => (
  <>
    <GestureDetector gesture={stage.gesture.gesture}>
      <View
        testID={FOCUS_STAGE_PART.SURFACE}
        style={styles.fill}
        accessible
        role="button"
        accessibilityLabel={stage.label}
        accessibilityHint={stage.hint}
        accessibilityActions={stage.actions}
        onAccessibilityAction={stage.act}>
        {children}
      </View>
    </GestureDetector>
    <SpokenStatus message={stage.spoken.change} />
    <SpokenStatus message={stage.spoken.edge} />
  </>
);

type CountDrag = {
  side: SharedValue<number>;
  down: SharedValue<number>;
  canUndo: boolean;
  reduceMotion: boolean;
};

/** The count under a drag: it fades as the text moves aside, and sinks under an undo. */
export const useCountDrag = ({ side, down, canUndo, reduceMotion }: CountDrag) => {
  const sink = canUndo ? FOCUS_MOTION.SINK : FOCUS_MOTION.SINK_EMPTY;
  return useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(side.get()) / FOCUS_MOTION.COUNT_FADE, 1),
    transform: [{ translateY: reduceMotion ? 0 : Math.min(down.get() * sink.SHARE, sink.MAX) }],
  }));
};

type PlaceProps = StageProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** The session position: it comes quickly and leaves slowly. */
export const FocusPlace = ({
  stage,
  children,
  style,
  testID = FOCUS_STAGE_PART.PLACE,
}: PlaceProps) => {
  const { placeVisible } = stage;
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(
      withTiming(placeVisible ? 1 : 0, {
        duration: placeVisible ? DURATION_MS.QUICK : DURATION_MS.DISSOLVE,
      })
    );
  }, [placeVisible, opacity]);
  const shown = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View testID={testID} pointerEvents="none" style={[style, shown]}>
      {children}
    </Animated.View>
  );
};

/** The current dhikr between its neighbours, following a side drag. */
export const FocusPager = ({ stage }: StageProps) => {
  const { session, place, gesture, width, isRTL, reduceMotion, tall } = stage;
  const { offset, side, arrive } = gesture;

  const rowStyle = useAnimatedStyle(() => {
    const dim = reduceMotion
      ? 1 - Math.min(Math.abs(side.get()) / (FOCUS_MOTION.DIM.SHARE * width), FOCUS_MOTION.DIM.MAX)
      : 1;
    return { opacity: arrive.get() * dim, transform: [{ translateX: offset.get() }] };
  });

  return (
    <View
      testID={FOCUS_STAGE_PART.PAGER}
      style={styles.pager}
      onLayout={({ nativeEvent: { layout } }) =>
        stage.onTextZone({ top: layout.y, bottom: layout.y + layout.height })
      }>
      <Animated.View testID={FOCUS_STAGE_PART.ROW} style={[StyleSheet.absoluteFill, rowStyle]}>
        {NEIGHBOURS.map((by) => {
          const at = place + by;
          const item = session.items[at];
          if (!item) return null;
          const { id: textId, text } = textAt(item, session.counts);
          return (
            <View
              key={item.id}
              style={[
                StyleSheet.absoluteFill,
                { transform: [{ translateX: slotX(at, width, isRTL) }] },
              ]}>
              <FocusText
                // A group's next text opens at its top, with its own measures.
                key={textId}
                text={text}
                here={by === 0}
                scrolls={tall[textId] ?? false}
                alongside={gesture.gesture}
                onTall={(isTall) => stage.onTall(textId, isTall)}
              />
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
};

type FocusTextProps = {
  text: DhikrText;
  /** The current dhikr, not a neighbour. */
  here: boolean;
  /** Taller than its space, as `onTall` last reported. */
  scrolls: boolean;
  /** The surface's touch, which runs beside the scroll. */
  alongside: PanGesture;
  onTall: (tall: boolean) => void;
};

/** Lines taller than their space, past a rounding point. */
const overflows = (space: number, lines: number) => lines > space + 1;

/** One dhikr, centred; it scrolls only when it is taller than its space. */
const FocusText = ({ text, here, scrolls, alongside, onTall }: FocusTextProps) => {
  // Both layouts can land in one batch; a ref holds the other's latest.
  const sizes = useRef({ space: 0, lines: 0 });
  const measured = (size: Partial<{ space: number; lines: number }>) => {
    sizes.current = { ...sizes.current, ...size };
    const { space, lines } = sizes.current;
    if (space === 0 || lines === 0) return;
    onTall(overflows(space, lines));
  };
  return (
    <ScrollView
      simultaneousWith={alongside}
      testID={here ? FOCUS_STAGE_PART.TEXT_SCROLL : undefined}
      scrollEnabled={scrolls}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.text}
      onLayout={({ nativeEvent }) => measured({ space: nativeEvent.layout.height })}>
      <Box
        testID={here ? FOCUS_STAGE_PART.TEXT : undefined}
        paddingHorizontal="$5"
        paddingVertical="$2"
        onLayout={({ nativeEvent }) => measured({ lines: nativeEvent.layout.height })}>
        <AthkarTextDisplay text={text} size="heading" fontWeight="600" color="$fg" />
      </Box>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pager: { flex: 1, overflow: "hidden" },
  text: { flexGrow: 1, justifyContent: "center" },
});
