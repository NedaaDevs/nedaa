import { Text as RNText, Platform, type TextStyle } from "react-native";
import { getTokenValue } from "tamagui";

import { useThemeColor } from "@/components/ui/theme-color";
import { PlatformType } from "@/enums/app";
import { formatNumberToLocale } from "@/utils/number";

const DIAMETER = { sm: 20, md: 24 } as const;
const BORDER_WIDTH = 1.5;
const IS_ANDROID = Platform.OS === PlatformType.ANDROID;

type NumberBadgeSize = keyof typeof DIAMETER;

export const NUMBER_BADGE_STYLE = {
  /** A disc ringed and inked in `color`, on `bg`. */
  RING: "ring",
  /** A rounded square filled with the accent, inked in the page colour. */
  FILLED: "filled",
} as const;
export type NumberBadgeStyle = (typeof NUMBER_BADGE_STYLE)[keyof typeof NUMBER_BADGE_STYLE];

type Props = {
  n: number;
  /** A theme token or a colour, for the digit and the rim. */
  color?: string;
  /** A theme token or a colour. */
  bg?: string;
  size?: NumberBadgeSize;
  /** FILLED sets its own colours; `color` and `bg` apply to RING only. */
  badgeStyle?: NumberBadgeStyle;
  x?: number;
  y?: number;
};

/** A number in a badge. It keeps a fixed size, so it does not follow the text scale. */
export const NumberBadge = ({
  n,
  color = "$accentPrimary",
  bg = "$background",
  size = "sm",
  badgeStyle = NUMBER_BADGE_STYLE.RING,
  x,
  y,
}: Props) => {
  const filled = badgeStyle === NUMBER_BADGE_STYLE.FILLED;
  const ink = useThemeColor(filled ? "$bg" : color);
  const fill = useThemeColor(filled ? "$accent" : bg);
  const diameter = DIAMETER[size];
  const isAbsolute = x !== undefined && y !== undefined;
  const border = filled ? 0 : BORDER_WIDTH;
  const lineBox = diameter - border * 2;

  const style: TextStyle = {
    ...(isAbsolute && { position: "absolute", left: x, top: y }),
    width: diameter,
    height: diameter,
    borderRadius: filled ? getTokenValue("$chip", "radius") : diameter / 2,
    borderWidth: border,
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
