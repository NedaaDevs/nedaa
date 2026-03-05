import Svg, { Circle } from "react-native-svg";
import { useTheme } from "tamagui";

const SIZE_PRESETS = {
  sm: { size: 28, strokeWidth: 3 },
  md: { size: 48, strokeWidth: 5 },
} as const;

type Props = {
  progress: number;
  size?: "sm" | "md";
  color?: string;
};

const ProgressRing = ({ progress, size = "md", color }: Props) => {
  const theme = useTheme();
  const { size: diameter, strokeWidth } = SIZE_PRESETS[size];
  const ringColor = color ?? theme.accentPrimary.val;

  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(Math.max(progress, 0), 1));

  return (
    <Svg
      width={diameter}
      height={diameter}
      viewBox={`0 0 ${diameter} ${diameter}`}
      style={{ transform: [{ rotate: "-90deg" }] }}>
      {/* Background track */}
      <Circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={radius}
        stroke={ringColor}
        strokeWidth={strokeWidth}
        fill="none"
        opacity={0.15}
      />
      {/* Progress arc */}
      <Circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={radius}
        stroke={ringColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </Svg>
  );
};

export default ProgressRing;
