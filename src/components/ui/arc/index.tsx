import { useState, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { useThemeColor } from "@/components/ui/theme-color";
import { SEGMENT_TONE, TICK_STATE, type SegmentTone, type TickState } from "@/constants/Arc";

/** Test ids; the arc is drawing only, so the screen reader sees none of it. */
export const ARC_PART = {
  TICK: "arc-tick",
  SEGMENT: "arc-segment",
  NOW: "arc-now",
  HORIZON: "arc-horizon",
} as const;

export type ArcTick = { id: string; x: number; y: number; state: TickState };
export type ArcSegment = { id: string; d: string; tone: SegmentTone };

/** What the arc draws, in its own points. */
export type ArcDrawing = {
  /** The whole line as an SVG path. */
  track: string;
  horizon: { y: number; from: number; to: number };
  ticks: ArcTick[];
  /** Only the stretches that show; the rest of the line stays plain. */
  segments: ArcSegment[];
  /** The current moment on the line, or null when it falls outside. */
  now: { x: number; y: number } | null;
};

/** The arc's height; its width is whatever its parent gives it. */
export const ARC_HEIGHT = 52;

type Props = {
  /** The drawing for the arc's measured box. */
  draw: (box: { width: number; height: number }) => ArcDrawing;
  /** The tick drawn as chosen, whatever its time. */
  selected?: string;
};

/** The parent's width, measured; the window's until the first layout. */
const useMeasuredWidth = () => {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => setWidth(nativeEvent.layout.width);
  return { width, onLayout };
};

/** Mark radii in points: fixed, as the line stretches unevenly to its box. */
const RADIUS = { tick: 3.5, current: 4.5, glow: 8, now: 6 } as const;

/** A timeline drawn as a line with marks: past, current, chosen, and now. */
export const Arc = ({ draw, selected }: Props) => {
  const { width, onLayout } = useMeasuredWidth();
  const height = ARC_HEIGHT;
  const { track, horizon, ticks, segments, now } = draw({ width, height });
  const fg = useThemeColor("$fg");
  const muted = useThemeColor("$muted");
  const accent = useThemeColor("$accent");
  const accentSoft = useThemeColor("$accentSoft");
  const surface = useThemeColor("$surface");
  const surface2 = useThemeColor("$surface2");

  const tickStyle = ({ id, state }: ArcTick) => {
    if (id === selected) return { r: RADIUS.current, fill: accent, stroke: accentSoft, width: 2.4 };
    if (state === TICK_STATE.CURRENT) {
      return { r: RADIUS.current, fill: accent, stroke: surface, width: 3 };
    }
    if (state === TICK_STATE.PASSED)
      return { r: RADIUS.tick, fill: surface2, stroke: muted, width: 1.4 };
    return { r: RADIUS.tick, fill: surface, stroke: fg, width: 1.4 };
  };
  const current = ticks.find((tick) => tick.state === TICK_STATE.CURRENT);

  return (
    <View
      onLayout={onLayout}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none">
      <Svg width={width} height={height}>
        <Line
          testID={ARC_PART.HORIZON}
          x1={horizon.from}
          y1={horizon.y}
          x2={horizon.to}
          y2={horizon.y}
          stroke={fg}
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.16}
        />
        <Path
          d={track}
          fill="none"
          stroke={fg}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.38}
        />
        {segments.map(({ id, d, tone }) => (
          <Path
            key={id}
            testID={ARC_PART.SEGMENT}
            d={d}
            fill="none"
            stroke={tone === SEGMENT_TONE.SELECTED ? accent : muted}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={tone === SEGMENT_TONE.SELECTED ? 0.85 : 0.5}
          />
        ))}
        {current && (
          <Circle cx={current.x} cy={current.y} r={RADIUS.glow} fill={accent} opacity={0.22} />
        )}
        {ticks.map((tick) => {
          const style = tickStyle(tick);
          return (
            <Circle
              key={tick.id}
              testID={ARC_PART.TICK}
              cx={tick.x}
              cy={tick.y}
              r={style.r}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.width}
            />
          );
        })}
        {now && (
          <Circle
            testID={ARC_PART.NOW}
            cx={now.x}
            cy={now.y}
            r={RADIUS.now}
            fill={surface}
            stroke={accent}
            strokeWidth={2}
          />
        )}
      </Svg>
    </View>
  );
};

/** Label boxes under the line: each centred on its tick, in one of two rows. */
export const ARC_LABEL = { width: 80, row: 27 } as const;

export type ArcLabel = { id: string; share: number; row: 0 | 1; children: ReactNode };

// Labels placed along the line by share of its width. The offset is logical, so
// it follows reading direction the same way the line is mirrored.
export const ArcLabels = ({ labels }: { labels: ArcLabel[] }) => {
  const { width, onLayout } = useMeasuredWidth();
  return (
    <View style={styles.labels} onLayout={onLayout} importantForAccessibility="no-hide-descendants">
      {labels.map(({ id, share, row, children }) => (
        <View
          key={id}
          style={[
            styles.label,
            { start: share * width - ARC_LABEL.width / 2, top: row * ARC_LABEL.row },
          ]}>
          {children}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  labels: { height: ARC_LABEL.row * 2 },
  label: { position: "absolute", width: ARC_LABEL.width, alignItems: "center" },
});
