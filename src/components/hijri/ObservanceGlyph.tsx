import Svg, { Circle, Path } from "react-native-svg";

import { Rect } from "@/components/ui/svg-geometry";
import { useThemeColor } from "@/components/ui/theme-color";
import { GLYPH_SHAPE, OBSERVANCE_MARK } from "@/constants/ObservanceMarks";
import type { ObservanceClass } from "@/enums/observances";

const VIEWBOX = "0 0 24 24";
const CENTRE = 12;
const RING_RADIUS = 7;
const RING_STROKE = 2;
const SQUARE = { x: 4.5, size: 15, radius: 3 } as const;
const CRESCENT_PATH = "M15 3.5a8.5 8.5 0 104.9 14.6A7 7 0 0115 3.5z";
const STAR = { points: 16, outer: 9.5, inner: 4.6 } as const;

/** An eight-point star: sixteen vertices alternating outer and inner radius. */
const STAR_PATH = `${Array.from({ length: STAR.points }, (_, i) => {
  const angle = (Math.PI / 8) * i - Math.PI / 2;
  const radius = i % 2 ? STAR.inner : STAR.outer;
  const x = (CENTRE + radius * Math.cos(angle)).toFixed(2);
  const y = (CENTRE + radius * Math.sin(angle)).toFixed(2);
  return `${i ? "L" : "M"}${x} ${y}`;
}).join("")}Z`;

type Props = { observanceClass: ObservanceClass; size: number };

/** A class's mark, drawn in its colour; decorative, so the caller names it. */
export const ObservanceGlyph = ({ observanceClass, size }: Props) => {
  const { shape, color } = OBSERVANCE_MARK[observanceClass];
  const fill = useThemeColor(color);
  return (
    <Svg width={size} height={size} viewBox={VIEWBOX} accessible={false}>
      {shape === GLYPH_SHAPE.RING ? (
        <Circle
          cx={CENTRE}
          cy={CENTRE}
          r={RING_RADIUS}
          stroke={fill}
          strokeWidth={RING_STROKE}
          fill="none"
        />
      ) : shape === GLYPH_SHAPE.SQUARE ? (
        <Rect
          x={SQUARE.x}
          y={SQUARE.x}
          width={SQUARE.size}
          height={SQUARE.size}
          rx={SQUARE.radius}
          fill={fill}
        />
      ) : (
        <Path d={shape === GLYPH_SHAPE.CRESCENT ? CRESCENT_PATH : STAR_PATH} fill={fill} />
      )}
    </Svg>
  );
};
