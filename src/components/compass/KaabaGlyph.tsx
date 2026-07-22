import { G, Line, Rect, Svg } from "react-native-svg";

// Realistic Kaaba colors in both themes by design; only surrounding UI takes theme tokens.
const CUBE = "#14171C";
const ROOF = "#1D222B";
const BAND = "#E6C469";
const STITCH = "#A8863F";
const DOOR_INNER = "#C9A44E";

export const KAABA_VIEWBOX_WIDTH = 56;
export const KAABA_VIEWBOX_HEIGHT = 60;

/** Shape group for embedding inside another Svg (viewBox 0 0 56 60). */
export const KaabaShapes = () => (
  <G>
    <Rect x={6} y={10} width={44} height={46} rx={2} fill={CUBE} />
    <Rect x={6} y={10} width={44} height={4} rx={2} fill={ROOF} />
    <Rect x={6} y={19} width={44} height={7} fill={BAND} />
    <G stroke={STITCH} strokeWidth={1}>
      {[10, 20, 30, 40].map((x) => (
        <G key={x}>
          <Line x1={x} y1={21} x2={x + 4} y2={24} />
          <Line x1={x + 4} y1={21} x2={x} y2={24} />
        </G>
      ))}
    </G>
    <Rect x={34} y={34} width={9} height={14} rx={1.5} fill={BAND} />
    <Rect x={36} y={36} width={5} height={10} rx={1} fill={DOOR_INNER} />
  </G>
);

type KaabaGlyphProps = {
  size?: number;
  testID?: string;
};

export const KaabaGlyph = ({ size = 24, testID }: KaabaGlyphProps) => (
  <Svg
    testID={testID}
    width={size}
    height={(size * KAABA_VIEWBOX_HEIGHT) / KAABA_VIEWBOX_WIDTH}
    viewBox={`0 0 ${KAABA_VIEWBOX_WIDTH} ${KAABA_VIEWBOX_HEIGHT}`}>
    <KaabaShapes />
  </Svg>
);
