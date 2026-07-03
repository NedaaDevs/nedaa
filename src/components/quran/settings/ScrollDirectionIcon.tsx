import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ScrollDirection } from "@/enums/quran";

// A small illustrated glyph for the reader's Scroll-direction control. Both
// options share one motif — a rounded "page window" (a bordered, clipping View)
// onto a content strip that continuously glides in the labelled direction:
// horizontal = paging sideways, vertical = lines scrolling up. The motion is the
// affordance — it always loops (on both segments) so a glance tells the modes
// apart. Colour follows the segment's text tint.
//
// Two platform gotchas shaped this:
//  - Drawn with plain Views, not react-native-svg: SVG composites on the JS thread
//    (viewBox maths), so a native-thread transform doesn't move it on iOS.
//  - reduceMotion: Never — Reanimated honours the OS "Reduce Motion" setting by
//    default, which silently froze the loop on iOS. This glyph's whole purpose is
//    to move, so it opts out. The strip repeats one period for a seamless wrap.

type Props = {
  direction: ScrollDirection;
  color: string;
  size?: number;
};

// Vertical strip line widths (fraction of window width), cycled down the column.
const V_WIDTHS = [1, 0.68, 0.86, 0.55, 0.78];
const V_PERIOD = V_WIDTHS.length;
const LOOP_MS = 2400;

export const ScrollDirectionIcon = ({ direction, color, size = 22 }: Props) => {
  const isVertical = direction === ScrollDirection.VERTICAL;

  const u = size / 24;
  const border = Math.max(1.3, 1.6 * u);
  const frameW = 14 * u;
  const frameH = 17 * u;
  const interiorW = frameW - 2 * border;
  const interiorH = frameH - 2 * border;

  // Vertical geometry: a row every vPitch; travel one period (5 rows) per loop.
  const lineH = Math.max(1.4, 1.5 * u);
  const vPitch = 2.6 * u;
  const vGap = vPitch - lineH;
  const vTravel = V_PERIOD * vPitch;
  const vRowCount = Math.ceil((interiorH + vTravel) / vPitch) + 2;
  const vInset = 1 * u;

  // Horizontal geometry: a page every hPitch; travel one page per loop.
  const pageW = 8 * u;
  const pageH = 11 * u;
  const hGap = 2 * u;
  const hPitch = pageW + hGap;
  const hPageCount = 4;
  const travel = isVertical ? vTravel : hPitch;

  const t = useSharedValue(0);
  useEffect(() => {
    // reduceMotion: Never on BOTH the timing and the repeat — under the OS Reduce
    // Motion setting, an unopted withRepeat collapses the infinite loop to one play.
    t.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      false,
      undefined,
      ReduceMotion.Never
    );
    return () => cancelAnimation(t);
  }, [t]);

  const stripStyle = useAnimatedStyle(() =>
    isVertical
      ? { transform: [{ translateY: -t.value * travel }] }
      : { transform: [{ translateX: -t.value * travel }] }
  );

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: frameW,
          height: frameH,
          borderRadius: 3 * u,
          borderWidth: border,
          borderColor: color,
          overflow: "hidden",
        }}>
        <Animated.View
          style={[
            isVertical
              ? { width: interiorW, paddingLeft: vInset, gap: vGap }
              : { flexDirection: "row", height: interiorH, alignItems: "center", gap: hGap },
            stripStyle,
          ]}>
          {isVertical
            ? Array.from({ length: vRowCount }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: V_WIDTHS[i % V_PERIOD] * (interiorW - 2 * vInset),
                    height: lineH,
                    borderRadius: lineH / 2,
                    backgroundColor: color,
                  }}
                />
              ))
            : Array.from({ length: hPageCount }, (_, p) => (
                <View
                  key={p}
                  style={{
                    width: pageW,
                    height: pageH,
                    borderRadius: 1.6 * u,
                    borderWidth: Math.max(1, 1.1 * u),
                    borderColor: color,
                    paddingHorizontal: 1.6 * u,
                    justifyContent: "center",
                    gap: 1.6 * u,
                  }}>
                  {[0.85, 0.6, 0.72].map((w, li) => (
                    <View
                      key={li}
                      style={{
                        width: `${w * 100}%`,
                        height: Math.max(0.9, u),
                        borderRadius: u,
                        backgroundColor: color,
                      }}
                    />
                  ))}
                </View>
              ))}
        </Animated.View>
      </View>
    </View>
  );
};
