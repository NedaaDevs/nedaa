import { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View, type AccessibilityActionEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { GestureDetector, ScrollView, type PanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import { ClassicPositionMarks } from "@/components/athkar/looks/classic/ClassicPosition";
import { FocusOrbit } from "@/components/athkar/looks/classic/FocusOrbit";
import type { AthkarFocusProps } from "@/components/athkar/looks/types";
import {
  FocusGestureMarks,
  FocusSideMarks,
  signedCount,
} from "@/components/athkar/session/FocusHint";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { SpokenStatus } from "@/components/ui/live-region";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { A11Y_ACTION } from "@/constants/Accessibility";
import {
  FOCUS_ACTION,
  FOCUS_MOTION,
  FOCUS_TIMING,
  STEP,
  type StepDirection,
} from "@/constants/AthkarFocus";
import { DURATION_MS } from "@/constants/Motion";
import { useRTL } from "@/contexts/RTLContext";
import { useChangeOnly } from "@/hooks/useChangeOnly";
import { useFocusGesture } from "@/hooks/useFocusGesture";
import { useCountText, useRatioText } from "@/hooks/useRatioText";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAthkarStore } from "@/stores/athkar";
import { textKeyAt } from "@/utils/athkarSession";
import { athkarLine } from "@/utils/athkarText";
import { holdAmount, slotX } from "@/utils/focusGesture";

/** Test ids for the Focus stage's parts. */
export const CLASSIC_FOCUS_PART = {
  SURFACE: "classic-focus-surface",
  PLACE: "classic-focus-place",
  ROW: "classic-focus-row",
  TEXT: "classic-focus-text",
  TEXT_SCROLL: "classic-focus-text-scroll",
} as const;

/** The dhikr on each side of the place stays drawn, so a drag shows it. */
const NEIGHBOURS = [STEP.PREVIOUS, 0, STEP.NEXT] as const;

type Zone = { top: number; bottom: number };

/** True for `ms` after each change of `token`; false until the first one. */
const useShownAfterChange = (token: number, ms: number): boolean => {
  const [state, setState] = useState({ token, shown: false });
  if (state.token !== token) setState({ token, shown: true });
  useEffect(() => {
    if (!state.shown) return;
    const timer = setTimeout(() => setState((now) => ({ ...now, shown: false })), ms);
    return () => clearTimeout(timer);
  }, [state, ms]);
  return state.shown;
};

/** The Classic look of Focus: one dhikr, its count, a whole screen to touch. */
export const ClassicFocus = ({
  session,
  period,
  hintSeen,
  onHintSeen,
  onStep,
  close,
  audio,
}: AthkarFocusProps) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useRTL();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const countText = useCountText();
  const ratioText = useRatioText();
  const showTranslation = useAthkarStore((s) => s.settings.showTranslation);

  const { current, index, items, counts } = session;
  const place = index ?? 0;
  const count = current?.count ?? 0;
  const target = current?.target ?? 0;
  // Audio that owns the count closes the tap, the hold and the undo.
  const locked = current?.audioOwnsCount ?? false;
  const canTap = !locked;
  const canUndo = !locked && session.canUndo;
  const room = locked ? 0 : holdAmount(count, target);

  // The hint is drawn on a first visit only, and goes at the first touch.
  const [hinting] = useState(!hintSeen);
  const [touched, setTouched] = useState(false);
  const [edge, setEdge] = useState<{ by: StepDirection } | null>(null);
  const [tall, setTall] = useState<Readonly<Record<string, boolean>>>({});
  const [textZone, setTextZone] = useState<Zone | null>(null);
  const placeShown = useShownAfterChange(place, FOCUS_TIMING.POSITION_MS);

  useEffect(() => {
    if (!edge) return;
    const timer = setTimeout(() => setEdge(null), FOCUS_TIMING.EDGE_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [edge]);

  const touch = () => {
    if (touched) return;
    setTouched(true);
    if (hinting) onHintSeen();
  };

  const scrolls = current ? (tall[current.item.id] ?? false) : false;
  const gesture = useFocusGesture({
    index: place,
    width,
    rtl: isRTL,
    reduceMotion,
    canPrevious: session.canStep.previous,
    canNext: session.canStep.next,
    canTap,
    canUndo,
    holdRoom: room,
    scrollZone: scrolls ? textZone : null,
    onTouch: touch,
    onTap: session.add,
    onStep,
    // A new object each time, so a second try restarts the line's time.
    onEdge: (by) => setEdge({ by }),
    onUndo: session.undo,
    onHold: session.addMany,
  });
  const { offset, side, arrive } = gesture;

  const placeOpacity = useSharedValue(0);
  const placeVisible = placeShown || edge !== null;
  useEffect(() => {
    placeOpacity.set(
      withTiming(placeVisible ? 1 : 0, {
        duration: placeVisible ? DURATION_MS.QUICK : DURATION_MS.DISSOLVE,
      })
    );
  }, [placeVisible, placeOpacity]);
  const placeStyle = useAnimatedStyle(() => ({ opacity: placeOpacity.get() }));

  const rowStyle = useAnimatedStyle(() => {
    const dim = reduceMotion
      ? 1 - Math.min(Math.abs(side.get()) / (FOCUS_MOTION.DIM.SHARE * width), FOCUS_MOTION.DIM.MAX)
      : 1;
    return { opacity: arrive.get() * dim, transform: [{ translateX: offset.get() }] };
  });

  const placeLine = t("athkar.audio.thikrProgress", {
    current: countText(place + 1),
    total: countText(items.length),
  });
  const counted = t("a11y.athkar.cardProgress", {
    current: countText(count),
    total: countText(target),
  });
  const audioCounts = t("athkar.session.audioCounts");
  const edgeLine =
    edge === null
      ? null
      : t(edge.by === STEP.NEXT ? "athkar.session.lastThikr" : "athkar.focus.firstThikr");
  // A new place says where it is; a count by hand says the count.
  const arrival = count === 0 ? placeLine : t("a11y.join", { first: placeLine, second: counted });
  const [said, setSaid] = useState({ place, count, line: arrival });
  if (said.place !== place) setSaid({ place, count, line: arrival });
  else if (said.count !== count) setSaid({ place, count, line: locked ? said.line : counted });
  const changed = useChangeOnly(said.line);

  if (!current) return null;

  const statusLine =
    edgeLine ?? (locked ? audioCounts : current.done ? t("athkar.session.thikrDone") : null);
  const change = gesture.holding
    ? signedCount("+", countText(room))
    : gesture.undoArmed
      ? signedCount("−", countText(1))
      : null;

  const spokenText = athkarLine(t(current.textKey), i18n.language, showTranslation);
  const label = [spokenText, counted, ...(locked ? [audioCounts] : [])].reduce((first, second) =>
    t("a11y.join", { first, second })
  );
  const actions = [
    ...(canTap ? [{ name: A11Y_ACTION.ACTIVATE }] : []),
    // One repeat left is what activating adds.
    ...(room > 1
      ? [{ name: FOCUS_ACTION.ADD_MANY, label: t("a11y.athkar.focus.addMany", { count: room }) }]
      : []),
    ...(canUndo ? [{ name: FOCUS_ACTION.UNDO, label: t("athkar.session.undo") }] : []),
    ...(session.canStep.next
      ? [{ name: FOCUS_ACTION.NEXT, label: t("a11y.athkar.focus.nextThikr") }]
      : []),
    ...(session.canStep.previous
      ? [{ name: FOCUS_ACTION.PREVIOUS, label: t("a11y.athkar.focus.previousThikr") }]
      : []),
  ];
  const act = ({ nativeEvent: { actionName } }: AccessibilityActionEvent) => {
    if (actionName === A11Y_ACTION.ACTIVATE) session.add();
    else if (actionName === FOCUS_ACTION.ADD_MANY) session.addMany(room);
    else if (actionName === FOCUS_ACTION.UNDO) session.undo();
    else if (actionName === FOCUS_ACTION.NEXT) onStep(STEP.NEXT);
    else if (actionName === FOCUS_ACTION.PREVIOUS) onStep(STEP.PREVIOUS);
  };

  return (
    <View style={styles.fill}>
      <HStack alignItems="center" paddingHorizontal="$3.5">
        {audio}
        <Text flex={1} size="label" fontWeight="600" color="$muted" textAlign="center">
          {period}
        </Text>
        {close}
      </HStack>
      <GestureDetector gesture={gesture.gesture}>
        <View
          testID={CLASSIC_FOCUS_PART.SURFACE}
          style={styles.fill}
          accessible
          role="button"
          accessibilityLabel={label}
          accessibilityHint={canTap && !current.done ? t("athkar.focus.tapToIncrement") : undefined}
          accessibilityActions={actions}
          onAccessibilityAction={act}>
          <Animated.View testID={CLASSIC_FOCUS_PART.PLACE} style={placeStyle}>
            <HStack minHeight="$7" alignItems="center" paddingHorizontal="$5">
              <ClassicPositionMarks
                marks={session.marks}
                figures={ratioText(place + 1, items.length)}
                fraction={target > 0 ? count / target : 0}
              />
            </HStack>
          </Animated.View>
          <Box minHeight="$6" paddingHorizontal="$5">
            {hinting && <FocusSideMarks visible={!touched} />}
          </Box>

          <View
            style={styles.pager}
            onLayout={({ nativeEvent: { layout } }) =>
              setTextZone({ top: layout.y, bottom: layout.y + layout.height })
            }>
            <Animated.View
              testID={CLASSIC_FOCUS_PART.ROW}
              style={[StyleSheet.absoluteFill, rowStyle]}>
              {NEIGHBOURS.map((by) => {
                const at = place + by;
                const item = items[at];
                if (!item) return null;
                const here = by === 0;
                return (
                  <View
                    key={item.id}
                    style={[
                      StyleSheet.absoluteFill,
                      { transform: [{ translateX: slotX(at, width, isRTL) }] },
                    ]}>
                    <FocusText
                      textKey={textKeyAt(item, counts)}
                      here={here}
                      scrolls={tall[item.id] ?? false}
                      alongside={gesture.gesture}
                      onTall={(isTall) =>
                        setTall((now) =>
                          (now[item.id] ?? false) === isTall ? now : { ...now, [item.id]: isTall }
                        )
                      }
                    />
                  </View>
                );
              })}
            </Animated.View>
          </View>

          <VStack alignItems="center" paddingHorizontal="$5" paddingBottom="$8">
            <FocusOrbit
              count={count}
              target={target}
              countText={countText(count)}
              targetText={countText(target)}
              targetLine={t("athkar.focus.ofTarget", { target: countText(target) })}
              change={change}
              armed={gesture.undoArmed}
              canUndo={canUndo}
              reduceMotion={reduceMotion}
              hold={gesture.hold}
              side={side}
              down={gesture.down}
            />
            <Box minHeight="$6" marginTop="$3" justifyContent="center">
              {statusLine !== null ? (
                <Text size="md" fontWeight="500" color="$muted" textAlign="center">
                  {statusLine}
                </Text>
              ) : (
                hinting && <FocusGestureMarks visible={!touched} />
              )}
            </Box>
          </VStack>
        </View>
      </GestureDetector>
      <SpokenStatus message={changed} />
      <SpokenStatus message={edgeLine} />
    </View>
  );
};

type FocusTextProps = {
  textKey: string;
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
const FocusText = ({ textKey, here, scrolls, alongside, onTall }: FocusTextProps) => {
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
      testID={here ? CLASSIC_FOCUS_PART.TEXT_SCROLL : undefined}
      scrollEnabled={scrolls}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.text}
      onLayout={({ nativeEvent }) => measured({ space: nativeEvent.layout.height })}>
      <Box
        testID={here ? CLASSIC_FOCUS_PART.TEXT : undefined}
        paddingHorizontal="$5"
        paddingVertical="$2"
        onLayout={({ nativeEvent }) => measured({ lines: nativeEvent.layout.height })}>
        <AthkarTextDisplay textKey={textKey} size="heading" fontWeight="600" color="$fg" />
      </Box>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pager: { flex: 1, overflow: "hidden" },
  text: { flexGrow: 1, justifyContent: "center" },
});
