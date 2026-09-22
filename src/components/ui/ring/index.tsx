import Svg, { Circle } from "react-native-svg";

import { useThemeColor } from "@/components/ui/theme-color";

const SIZE_PRESETS = {
  sm: { size: 28, strokeWidth: 3 },
  md: { size: 48, strokeWidth: 5 },
} as const;

type RingSize = keyof typeof SIZE_PRESETS;

type Props = {
  /** Fraction complete, clamped to 0–1. */
  progress: number;
  size?: RingSize;
  /** A theme token or a colour. */
  color?: string;
};

export const Ring = ({ progress, size = "md", color = "$accentPrimary" }: Props) => {
  const ringColor = useThemeColor(color);
  const { size: diameter, strokeWidth } = SIZE_PRESETS[size];
  const fraction = Math.min(Math.max(progress, 0), 1);

  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - fraction);

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

export type { RingSize };
