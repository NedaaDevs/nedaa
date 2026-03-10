import Svg, { Path, Circle, Rect, Line, G } from "react-native-svg";
import { View } from "react-native";
import { useTheme } from "tamagui";
import NumberBadge from "@/components/umrah/illustrations/NumberBadge";

type Props = {
  size?: number;
};

const IhramMale = ({ size = 200 }: Props) => {
  const theme = useTheme();
  const primary = theme.accentPrimary.val;
  const secondary = theme.typographySecondary.val;
  const bg = theme.backgroundSecondary.val;

  const scale = size / 200;

  return (
    <View style={{ width: size, height: size, direction: "ltr" }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {/* Head — uncovered, no hat/cap */}
        <Circle cx="100" cy="40" r="18" fill={secondary} opacity={0.25} />

        {/* Neck */}
        <Rect x="94" y="56" width="12" height="10" fill={secondary} opacity={0.2} />

        {/* Rida (upper garment) — draped cloth on shoulders */}
        <Path
          d="M72,66 Q100,62 128,66 L132,115 Q100,118 68,115 Z"
          fill={bg}
          stroke={primary}
          strokeWidth="1.5"
        />
        {/* Right shoulder exposed — dashed line showing Idtiba' */}
        <Line
          x1="128"
          y1="66"
          x2="132"
          y2="82"
          stroke={primary}
          strokeWidth="1.5"
          strokeDasharray="4,3"
        />
        {/* Rida drape line */}
        <Path
          d="M72,66 Q85,72 100,70 Q115,68 128,66"
          fill="none"
          stroke={primary}
          strokeWidth="1"
          opacity={0.5}
        />

        {/* Arms */}
        <Line x1="68" y1="72" x2="55" y2="105" stroke={secondary} strokeWidth="2" opacity={0.2} />
        <Line x1="132" y1="72" x2="145" y2="105" stroke={secondary} strokeWidth="2" opacity={0.2} />

        {/* Izar (lower garment) — wrapped cloth from waist to below knees */}
        <Rect
          x="74"
          y="113"
          width="52"
          height="55"
          rx="3"
          fill={bg}
          stroke={primary}
          strokeWidth="1.5"
        />
        {/* Izar wrap line */}
        <Line
          x1="100"
          y1="113"
          x2="100"
          y2="168"
          stroke={primary}
          strokeWidth="0.8"
          opacity={0.3}
        />

        {/* Legs visible below Izar */}
        <Line x1="88" y1="168" x2="88" y2="188" stroke={secondary} strokeWidth="2" opacity={0.2} />
        <Line
          x1="112"
          y1="168"
          x2="112"
          y2="188"
          stroke={secondary}
          strokeWidth="2"
          opacity={0.2}
        />

        {/* Sandals — open, showing ankles */}
        <Rect x="82" y="188" width="12" height="4" rx="2" fill={secondary} opacity={0.35} />
        <Rect x="106" y="188" width="12" height="4" rx="2" fill={secondary} opacity={0.35} />

        {/* Leader lines to annotation positions */}
        <G opacity={0.5}>
          <Line x1="136" y1="90" x2="152" y2="90" stroke={primary} strokeWidth="0.8" />
          <Line x1="130" y1="140" x2="152" y2="140" stroke={primary} strokeWidth="0.8" />
        </G>
      </Svg>

      {/* ① Rida badge */}
      <NumberBadge n={1} x={153 * scale} y={80 * scale} color={primary} bg={theme.background.val} />
      {/* ② Izar badge */}
      <NumberBadge
        n={2}
        x={153 * scale}
        y={130 * scale}
        color={primary}
        bg={theme.background.val}
      />
    </View>
  );
};

export default IhramMale;
