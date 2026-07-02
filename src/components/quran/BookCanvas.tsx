import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect, RadialGradient, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranThemeType } from "@/enums/quran";
import type { CanvasFrame } from "@/utils/readerSpread";

// Every visual knob in one place — tuned on real devices via hot reload.
export const BOOK_CANVAS_TUNING = {
  // Ambient ground: radius of the radial falloff relative to the screen diagonal.
  gradientRadius: 0.75,
  // Dot-grid pattern (frameColor ink) over the ground.
  patternOpacity: 0.08,
  patternSpacing: 22,
  patternDotRadius: 1.2,
  // Book slab: shadow + sheet under the page box(es).
  slabCornerRadius: 6,
  slabShadow: "0px 10px 28px rgba(0, 0, 0, 0.22)",
  // Page-edge hint: a slightly darker sliver of "stacked pages" peeking out.
  pageEdgeWidth: 3,
  pageEdgeOpacity: 0.25,
  // Spine crease: total band width; peak darkness at the center.
  creaseWidth: 36,
  creaseOpacity: 0.16,
  // Optional per-theme gold hairline around the slab; off by default.
  hairlineOpacity: 0,
} as const;

interface BookCanvasProps {
  width: number;
  height: number;
  theme: QuranThemeType;
  frame: CanvasFrame;
}

// Everything behind the pages on large devices: ambient ground, book slab,
// spine crease. Pages slide over it, so depth cues hold still during a turn.
// Pure decoration — nothing here can block reading.
const BookCanvas = ({ width, height, theme, frame }: BookCanvasProps) => {
  const colors = QURAN_THEME_COLORS[theme];
  const t = BOOK_CANVAS_TUNING;
  const { slab, creaseX } = frame;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="ground" cx="50%" cy="42%" r={`${t.gradientRadius * 100}%`}>
            <Stop offset="0%" stopColor={colors.canvasInner} />
            <Stop offset="100%" stopColor={colors.canvasOuter} />
          </RadialGradient>
          <Pattern
            id="dots"
            patternUnits="userSpaceOnUse"
            width={t.patternSpacing}
            height={t.patternSpacing}>
            <Circle
              cx={t.patternSpacing / 2}
              cy={t.patternSpacing / 2}
              r={t.patternDotRadius}
              fill={colors.frameColor}
              fillOpacity={t.patternOpacity}
            />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#ground)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#dots)" />
      </Svg>
      {/* Book slab: the sheet the pages sit on. boxShadow works cross-platform
          on the New Architecture. */}
      <View
        style={{
          position: "absolute",
          left: slab.x,
          top: slab.y,
          width: slab.w,
          height: slab.h,
          borderRadius: t.slabCornerRadius,
          backgroundColor: colors.background,
          boxShadow: t.slabShadow,
        }}
      />
      {/* Optional gold hairline: a separate layer so its opacity only dims the
          border, not the slab fill underneath. */}
      {t.hairlineOpacity > 0 && (
        <View
          style={{
            position: "absolute",
            left: slab.x,
            top: slab.y,
            width: slab.w,
            height: slab.h,
            borderRadius: t.slabCornerRadius,
            borderWidth: 1,
            borderColor: colors.frameColor,
            opacity: t.hairlineOpacity,
          }}
        />
      )}
      {/* Page-edge hint: stacked-pages sliver along the slab's bottom edge. */}
      <View
        style={{
          position: "absolute",
          left: slab.x + t.pageEdgeWidth,
          top: slab.y + slab.h,
          width: slab.w - t.pageEdgeWidth * 2,
          height: t.pageEdgeWidth,
          borderBottomLeftRadius: t.slabCornerRadius,
          borderBottomRightRadius: t.slabCornerRadius,
          backgroundColor: colors.canvasOuter,
          opacity: t.pageEdgeOpacity,
        }}
      />
      {creaseX !== null && (
        <LinearGradient
          colors={["transparent", `rgba(0,0,0,${t.creaseOpacity})`, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            position: "absolute",
            left: creaseX - t.creaseWidth / 2,
            top: slab.y,
            width: t.creaseWidth,
            height: slab.h,
          }}
        />
      )}
    </View>
  );
};

export default BookCanvas;
