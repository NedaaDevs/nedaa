import { Text as RNText, Platform, type TextStyle } from "react-native";

import { useThemeColor } from "@/components/ui/theme-color";
import { PlatformType } from "@/enums/app";
import { formatNumberToLocale } from "@/utils/number";

const DIAMETER = { sm: 20, md: 24 } as const;
const BORDER_WIDTH = 1.5;
const IS_ANDROID = Platform.OS === PlatformType.ANDROID;

type NumberBadgeSize = keyof typeof DIAMETER;

type Props = {
  n: number;
  /** A theme token or a colour, for the digit and the rim. */
  color?: string;
  /** A theme token or a colour. */
  bg?: string;
  size?: NumberBadgeSize;
  x?: number;
  y?: number;
};

/** A circled number. It keeps a fixed size, so it does not follow the text scale. */
export const NumberBadge = ({
  n,
  color = "$accentPrimary",
  bg = "$background",
  size = "sm",
  x,
  y,
}: Props) => {
  const ink = useThemeColor(color);
  const fill = useThemeColor(bg);
  const diameter = DIAMETER[size];
  const isAbsolute = x !== undefined && y !== undefined;
  const lineBox = diameter - BORDER_WIDTH * 2;

  const style: TextStyle = {
    ...(isAbsolute && { position: "absolute", left: x, top: y }),
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    borderWidth: BORDER_WIDTH,
    borderColor: ink,
    backgroundColor: fill,
    overflow: "hidden",
    fontSize: Math.round(diameter * 0.55),
    fontWeight: "700",
    color: ink,
    textAlign: "center",
    lineHeight: IS_ANDROID ? lineBox + 1 : lineBox,
    includeFontPadding: false,
  };

  return (
    <RNText allowFontScaling={false} style={style}>
      {formatNumberToLocale(n.toString())}
    </RNText>
  );
};

export type { NumberBadgeSize };
