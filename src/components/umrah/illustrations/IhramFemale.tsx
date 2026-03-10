import Svg, { Path, Circle, Rect, Line, G, Ellipse } from "react-native-svg";
import { View } from "react-native";
import { useTheme } from "tamagui";
import NumberBadge from "@/components/umrah/illustrations/NumberBadge";

type Props = {
  size?: number;
};

const IhramFemale = ({ size = 200 }: Props) => {
  const theme = useTheme();
  const primary = theme.accentPrimary.val;
  const secondary = theme.typographySecondary.val;
  const bg = theme.backgroundSecondary.val;

  const scale = size / 200;

  return (
    <View style={{ width: size, height: size, direction: "ltr" }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {/* Hijab — covers hair but NOT face */}
        <Path
          d="M82,32 Q82,18 100,15 Q118,18 118,32 L121,55 Q100,58 79,55 Z"
          fill={bg}
          stroke={primary}
          strokeWidth="1.5"
        />

        {/* Face — visible (no niqab) */}
        <Ellipse cx="100" cy="38" rx="12" ry="14" fill={secondary} opacity={0.2} />

        {/* Neck */}
        <Rect x="95" y="52" width="10" height="6" fill={secondary} opacity={0.15} />

        {/* Loose modest garment — full length */}
        <Path d="M76,55 L124,55 L130,182 L70,182 Z" fill={bg} stroke={primary} strokeWidth="1.5" />

        {/* Garment center line for visual detail */}
        <Line x1="100" y1="55" x2="100" y2="182" stroke={primary} strokeWidth="0.6" opacity={0.2} />

        {/* Sleeves — loose, long */}
        <Path d="M76,62 L56,108 L64,110 L80,72" fill={bg} stroke={primary} strokeWidth="1.2" />
        <Path d="M124,62 L144,108 L136,110 L120,72" fill={bg} stroke={primary} strokeWidth="1.2" />

        {/* Hands visible — no gloves (gloves prohibited in Ihram) */}
        <Circle cx="56" cy="110" r="4" fill={secondary} opacity={0.25} />
        <Circle cx="144" cy="110" r="4" fill={secondary} opacity={0.25} />

        {/* Shoes */}
        <Rect x="83" y="182" width="14" height="5" rx="2.5" fill={secondary} opacity={0.3} />
        <Rect x="103" y="182" width="14" height="5" rx="2.5" fill={secondary} opacity={0.3} />

        {/* Leader lines to annotation positions */}
        <G opacity={0.5}>
          <Line x1="122" y1="35" x2="152" y2="35" stroke={primary} strokeWidth="0.8" />
          <Line x1="148" y1="110" x2="152" y2="110" stroke={primary} strokeWidth="0.8" />
        </G>
      </Svg>

      {/* ① Hijab badge */}
      <NumberBadge n={1} x={153 * scale} y={25 * scale} color={primary} bg={theme.background.val} />
      {/* ② Hands badge */}
      <NumberBadge
        n={2}
        x={153 * scale}
        y={100 * scale}
        color={primary}
        bg={theme.background.val}
      />
    </View>
  );
};

export default IhramFemale;
