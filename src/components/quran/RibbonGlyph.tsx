import Svg, { Path } from "react-native-svg";

// Shared bookmark ribbon silhouette — a swallowtail body with an inset hairline
// echoing the Mihrab frame motif. Used filled (on-page marker + in-use picker
// slots) and as a dashed outline (a free picker slot).
export const RIBBON_PATH = "M6 2 H18 A3 3 0 0 1 21 5 V27 L12 20.8 L3 27 V5 A3 3 0 0 1 6 2 Z";
const RIBBON_INNER =
  "M7.1 4.2 H16.9 A1.5 1.5 0 0 1 18.4 5.7 V23.4 L12 18.9 L5.6 23.4 V5.7 A1.5 1.5 0 0 1 7.1 4.2 Z";

interface RibbonGlyphProps {
  size: number;
  color: string;
  outlined?: boolean;
}

const RibbonGlyph = ({ size, color, outlined }: RibbonGlyphProps) => {
  const w = size * (24 / 30);
  return (
    <Svg width={w} height={size} viewBox="0 0 24 30">
      {outlined ? (
        <Path
          d={RIBBON_PATH}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="2.5 2.5"
        />
      ) : (
        <>
          <Path d={RIBBON_PATH} fill={color} stroke="rgba(0,0,0,0.22)" strokeWidth={1} />
          <Path d={RIBBON_INNER} fill="none" stroke="rgba(255,248,238,0.34)" strokeWidth={1} />
        </>
      )}
    </Svg>
  );
};

export default RibbonGlyph;
