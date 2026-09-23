import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { Icon, type IconProps } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/components/ui/theme-color";
import { TICK_STATE, type TickState } from "@/constants/Timeline";
import { useRTL } from "@/contexts/RTLContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { spreadLabels } from "@/utils/spreadLabels";

/** Test ids; the timeline is drawing only, hidden from the screen reader. */
export const TIMELINE_PART = {
  ROOT: "timeline",
  MARK: "timeline-mark",
  TRACK: "timeline-track",
  FILL: "timeline-fill",
  SHIMMER: "timeline-shimmer",
  NAME: "timeline-name",
  DOT: "timeline-dot",
} as const;

/** The timeline's measures, in points and milliseconds. */
export const TIMELINE = {
  /** Room at each end, so the first and last names fit. */
  edge: 30,
  /** The icon's box, which the line stops short of. */
  mark: 26,
  gap: 5,
  thickness: 2,
  /** A mark drawn where its icon would hit the one before. */
  dot: 6,
  /** The widest a name grows; a longer one shrinks to fit. */
  labelWidth: 80,
  /** A name's width until it is measured, and the room kept between names. */
  nameWidth: 48,
  nameSpace: 8,
  /** The height of the row of names. */
  row: 18,
  /** How long the fill takes to reach a new length. */
  fillMs: 600,
  /** The shimmer's width, one sweep, and the rest between sweeps. */
  shimmer: 36,
  sweepMs: 1600,
  restMs: 2400,
} as const;

export type TimelineMark = {
  id: string;
  /** Where the mark sits, from 0 at the start of the line to 1 at the end. */
  share: number;
  state: TickState;
  icon: IconProps["as"];
  label: string;
};

type Props = {
  marks: TimelineMark[];
  /** The stretch under way, as shares of the line, and the part gone. */
  progress: { from: number; to: number; fraction: number } | null;
  /** The mark drawn as chosen, whatever its time. */
  selected?: string;
};

/** The parent's width, measured; the window's until the first layout. */
const useMeasuredWidth = () => {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => setWidth(nativeEvent.layout.width);
  return { width, onLayout };
};

/** Which marks draw a dot, where an icon would hit the one before. */
const dotted = (xs: number[]) => {
  let lastIcon = -Infinity;
  return xs.map((x) => {
    const dot = x - lastIcon < TIMELINE.mark;
    if (!dot) lastIcon = x;
    return dot;
  });
};

/** The filled part of the current stretch, easing to each new length. */
const Fill = ({ length, colour }: { length: number; colour: string }) => {
  const reduced = useReducedMotion();
  const { isRTL } = useRTL();
  const [width] = useState(() => new Animated.Value(reduced ? length : 0));
  const [sweep] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) {
      width.setValue(length);
      return;
    }
    const grow = Animated.timing(width, {
      toValue: length,
      duration: TIMELINE.fillMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    grow.start();
    return () => grow.stop();
  }, [length, reduced, width]);

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: TIMELINE.sweepMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(TIMELINE.restMs),
      ]),
      { resetBeforeIteration: true }
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, sweep]);

  // The sweep runs from the stretch's start to its end, on either side.
  const direction = isRTL ? -1 : 1;
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-TIMELINE.shimmer * direction, length * direction],
  });

  return (
    <Animated.View
      testID={TIMELINE_PART.FILL}
      style={[styles.fill, { width, backgroundColor: colour }]}>
      {!reduced && (
        <Animated.View
          testID={TIMELINE_PART.SHIMMER}
          style={[styles.shimmer, { transform: [{ translateX }] }]}
        />
      )}
    </Animated.View>
  );
};

/** Icons on a straight line, names under them, the current stretch filling. */
export const Timeline = ({ marks, progress, selected }: Props) => {
  const { width, onLayout } = useMeasuredWidth();
  const fg = useThemeColor("$fg");
  const accent = useThemeColor("$accent");
  const muted = useThemeColor("$muted");
  const [nameWidths, setNameWidths] = useState<Record<string, number>>({});
  const measureName = (id: string) => (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    setNameWidths((widths) => (widths[id] === measured ? widths : { ...widths, [id]: measured }));
  };

  const span = Math.max(0, width - 2 * TIMELINE.edge);
  const xOf = (share: number) => TIMELINE.edge + share * span;
  const xs = marks.map((mark) => xOf(mark.share));
  const dots = dotted(xs);
  const widthOf = (mark: TimelineMark) => nameWidths[mark.id] ?? TIMELINE.nameWidth;
  const names = spreadLabels(xs, marks.map(widthOf), width, TIMELINE.nameSpace);
  const lineY = TIMELINE.mark / 2;
  const height = TIMELINE.mark + 4 + TIMELINE.row;

  const stretch = (from: number, to: number) => {
    const start = xOf(from) + TIMELINE.mark / 2 + TIMELINE.gap;
    return { start, length: Math.max(0, xOf(to) - TIMELINE.mark / 2 - TIMELINE.gap - start) };
  };
  const colourOf = (mark: TimelineMark) =>
    mark.id === selected || mark.state === TICK_STATE.CURRENT ? "$accent" : "$muted";
  const current = progress && stretch(progress.from, progress.to);

  return (
    <View
      testID={TIMELINE_PART.ROOT}
      onLayout={onLayout}
      style={{ height }}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none">
      {marks.slice(1).map((mark, i) => {
        const { start, length } = stretch(marks[i].share, mark.share);
        return (
          <View
            key={mark.id}
            style={[styles.line, { start, width: length, top: lineY - 1, backgroundColor: fg }]}
          />
        );
      })}
      {current && (
        <View
          testID={TIMELINE_PART.TRACK}
          style={[styles.track, { start: current.start, width: current.length, top: lineY - 1 }]}>
          <Fill length={current.length * clampShare(progress.fraction)} colour={accent} />
        </View>
      )}
      {marks.map((mark, i) => {
        const colour = colourOf(mark);
        const strong = colour === "$accent";
        return (
          <View key={mark.id}>
            <View
              testID={TIMELINE_PART.MARK}
              style={[styles.mark, { start: xs[i] - TIMELINE.mark / 2 }]}>
              {dots[i] ? (
                <View
                  testID={TIMELINE_PART.DOT}
                  style={[styles.dot, { backgroundColor: strong ? accent : muted }]}
                />
              ) : (
                <Icon as={mark.icon} size="lg" color={colour} />
              )}
            </View>
            <View
              testID={TIMELINE_PART.NAME}
              onLayout={measureName(mark.id)}
              style={[styles.name, { start: names[i] - widthOf(mark) / 2 }]}>
              <Text
                size="sm"
                typography="helper"
                fontWeight={strong ? "700" : "600"}
                color={colour}
                numberOfLines={1}
                // A long name such as «شروق الشمس» shrinks to fit, never cut off.
                adjustsFontSizeToFit
                minimumFontScale={0.7}>
                {mark.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const clampShare = (n: number) => Math.min(1, Math.max(0, n));

const styles = StyleSheet.create({
  // Matte: the line reads as a guide, not a bar.
  line: { position: "absolute", height: TIMELINE.thickness, borderRadius: 1, opacity: 0.22 },
  track: { position: "absolute", height: TIMELINE.thickness, overflow: "hidden" },
  fill: { height: TIMELINE.thickness, borderRadius: 1, overflow: "hidden" },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: TIMELINE.shimmer,
    experimental_backgroundImage:
      "linear-gradient(90deg, #FFFFFF00 0%, #FFFFFFB3 50%, #FFFFFF00 100%)",
  },
  mark: {
    position: "absolute",
    top: 0,
    width: TIMELINE.mark,
    height: TIMELINE.mark,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { position: "absolute", top: TIMELINE.mark + 4, maxWidth: TIMELINE.labelWidth },
  dot: { width: TIMELINE.dot, height: TIMELINE.dot, borderRadius: TIMELINE.dot / 2 },
});
