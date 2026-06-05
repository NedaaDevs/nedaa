import { View } from "tamagui";
import Svg, { Circle } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { QURAN_FONT_FAMILY, toHafsDigits } from "@/constants/Quran";

interface RosetteProps {
  // Ayah number, rendered in Hafs digits.
  n: number;
  size?: number;
  color: `#${string}`;
}

// Ayah-end medallion: two concentric rings + eight points, with the ayah number
// in the mushaf font. Drawn on a 28-unit canvas and scaled to `size`.
const Rosette = ({ n, size = 26, color }: RosetteProps) => {
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { cx: 14 + 12.5 * Math.cos(a), cy: 14 + 12.5 * Math.sin(a) };
  });
  return (
    <View width={size} height={size} alignItems="center" justifyContent="center">
      <Svg width={size} height={size} viewBox="0 0 28 28" style={{ position: "absolute" }}>
        <Circle cx={14} cy={14} r={12.5} fill="none" stroke={color} strokeWidth={1} />
        <Circle
          cx={14}
          cy={14}
          r={9.5}
          fill="none"
          stroke={color}
          strokeWidth={0.6}
          opacity={0.55}
        />
        {dots.map((d, i) => (
          <Circle key={i} cx={d.cx} cy={d.cy} r={0.9} fill={color} opacity={0.7} />
        ))}
      </Svg>
      <Text style={{ fontSize: size * 0.34, color, fontFamily: QURAN_FONT_FAMILY }}>
        {toHafsDigits(n)}
      </Text>
    </View>
  );
};

export default Rosette;
