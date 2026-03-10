import Svg, { Path, Rect } from "react-native-svg";

type Props = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

const KaabaIcon = ({ size = 24, color = "#000", strokeWidth = 2 }: Props) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round">
    {/* Main cube body */}
    <Path d="M4 8 L12 4 L20 8 L20 20 L4 20 Z" />
    {/* Top face perspective line */}
    <Path d="M4 8 L12 12 L20 8" />
    {/* Vertical center line (depth) */}
    <Path d="M12 12 L12 20" />
    {/* Door arch */}
    <Path d="M9 20 L9 16 Q9 14 12 14 Q15 14 15 16 L15 20" />
    {/* Kiswah band */}
    <Path d="M4 13 L12 17 L20 13" />
  </Svg>
);

export default KaabaIcon;
