import { Text as RNText, Platform, type TextStyle } from "react-native";
import { formatNumberToLocale } from "@/utils/number";

type Props = {
  n: number;
  color: string;
  bg: string;
  size?: number;
  x?: number;
  y?: number;
};

const NumberBadge = ({ n, color, bg, size = 20, x, y }: Props) => {
  const isAbsolute = x !== undefined && y !== undefined;
  const fontSize = Math.round(size * 0.55);
  const borderWidth = size >= 24 ? 1.5 : 1.5;

  const style: TextStyle = {
    ...(isAbsolute && { position: "absolute", left: x, top: y }),
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth,
    borderColor: color,
    backgroundColor: bg,
    overflow: "hidden",
    fontSize,
    fontWeight: "700",
    color,
    textAlign: "center",
    lineHeight: Platform.OS === "android" ? size - borderWidth * 2 + 1 : size - borderWidth * 2,
    includeFontPadding: false,
  };

  return <RNText style={style}>{formatNumberToLocale(n.toString())}</RNText>;
};

export default NumberBadge;
