import { Fragment } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Dev-only measuring overlay for the Mushaf reader. Draws a numbered ruler from
// every edge so layout tweaks can be described by distance-from-edge in dp, and
// marks the safe-area insets (which drive the reader's real margins) in red.
//
// Toggle with DEBUG_READER_GUIDES in QuranReader. Not shipped (guarded by __DEV__).

// Spacing between ruler lines, and how often a line carries a dp label.
const TICK_STEP = 20;
const LABEL_EVERY = 40;

const LINE_COLOR = "rgba(0, 122, 255, 0.35)";
const LABEL_COLOR = "rgba(0, 122, 255, 0.9)";
const INSET_COLOR = "rgba(255, 45, 45, 0.8)";

const ticksUpTo = (limit: number): number[] => {
  const out: number[] = [];
  for (let v = 0; v <= limit; v += TICK_STEP) out.push(v);
  return out;
};

const isLabeled = (v: number) => v % LABEL_EVERY === 0;

const ReaderDebugGuides = () => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const horizontal = ticksUpTo(height); // distance from the TOP edge
  const vertical = ticksUpTo(width); // distance from the LEFT edge

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Horizontal lines: labelled left = from top, right = from bottom. */}
      {horizontal.map((y) => (
        <Fragment key={`h${y}`}>
          <View style={[styles.hLine, { top: y }]} />
          {isLabeled(y) && (
            <>
              <Text style={[styles.label, { top: y - 7, left: 2 }]}>{y}</Text>
              <Text style={[styles.labelRight, { top: y - 7, right: 2 }]}>
                {Math.round(height - y)}
              </Text>
            </>
          )}
        </Fragment>
      ))}

      {/* Vertical lines: labelled top = from left, bottom = from right. */}
      {vertical.map((x) => (
        <Fragment key={`v${x}`}>
          <View style={[styles.vLine, { left: x }]} />
          {isLabeled(x) && (
            <>
              <Text style={[styles.labelTop, { left: x + 2, top: 2 }]}>{x}</Text>
              <Text style={[styles.labelBottom, { left: x + 2, bottom: 2 }]}>
                {Math.round(width - x)}
              </Text>
            </>
          )}
        </Fragment>
      ))}

      {/* Safe-area insets — the lines the reader actually pads against. */}
      <View style={[styles.insetH, { top: insets.top }]} />
      <View style={[styles.insetH, { top: height - insets.bottom }]} />
      <View style={[styles.insetV, { left: insets.left }]} />
      <View style={[styles.insetV, { left: width - insets.right }]} />
      <Text style={[styles.insetLabel, { top: insets.top + 1, left: 30 }]}>
        safe top {Math.round(insets.top)}
      </Text>
      <Text style={[styles.insetLabel, { top: height - insets.bottom - 13, left: 30 }]}>
        safe bottom {Math.round(insets.bottom)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  hLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE_COLOR,
  },
  vLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: LINE_COLOR,
  },
  label: { position: "absolute", fontSize: 9, color: LABEL_COLOR },
  labelRight: { position: "absolute", fontSize: 9, color: LABEL_COLOR },
  labelTop: { position: "absolute", fontSize: 9, color: LABEL_COLOR },
  labelBottom: { position: "absolute", fontSize: 9, color: LABEL_COLOR },
  insetH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: INSET_COLOR,
  },
  insetV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: INSET_COLOR,
  },
  insetLabel: { position: "absolute", fontSize: 9, fontWeight: "600", color: INSET_COLOR },
});

export default ReaderDebugGuides;
