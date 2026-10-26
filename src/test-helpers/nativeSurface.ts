import type { ViewStyle } from "react-native";

import { AppDirection } from "@/enums/app";

// Each physical pair beside the logical twins Fabric renames it to on an RTL
// surface (swapLeftAndRightInYogaStyleProps and swapLeftAndRightInViewProps).
// Corner radii and border colours are view props: Fabric paints them, Yoga
// never reads them.
const EDGES = [
  ["left", "right", "start", "end"],
  ["marginLeft", "marginRight", "marginStart", "marginEnd"],
  ["paddingLeft", "paddingRight", "paddingStart", "paddingEnd"],
  ["borderLeftWidth", "borderRightWidth", "borderStartWidth", "borderEndWidth"],
  ["borderTopLeftRadius", "borderTopRightRadius", "borderTopStartRadius", "borderTopEndRadius"],
  [
    "borderBottomLeftRadius",
    "borderBottomRightRadius",
    "borderBottomStartRadius",
    "borderBottomEndRadius",
  ],
  ["borderLeftColor", "borderRightColor", "borderStartColor", "borderEndColor"],
] as const;

// ViewStyle is readonly; each rewrite works on a copy.
type MutableViewStyle = { -readonly [K in keyof ViewStyle]: ViewStyle[K] };

// A set `from` replaces `to`, as Fabric and Yoga both let it.
const move = <K extends keyof ViewStyle>(style: MutableViewStyle, from: K, to: K) => {
  if (style[from] === undefined) return;
  style[to] = style[from];
  delete style[from];
};

/** A style as Fabric lays it out and paints it on a phone read in `phone`. */
export const onPhone = (style: ViewStyle, phone: AppDirection): ViewStyle => {
  if (phone === AppDirection.LTR) return style;
  const swapped: MutableViewStyle = { ...style };
  EDGES.forEach(([left, right, start, end]) => {
    move(swapped, left, start);
    move(swapped, right, end);
  });
  return swapped;
};

/** A style with each start and end value on the side `direction` gives it. */
export const drawnSides = (style: ViewStyle, direction: AppDirection): ViewStyle => {
  const drawn: MutableViewStyle = { ...style };
  EDGES.forEach(([left, right, start, end]) => {
    const ltr = direction === AppDirection.LTR;
    move(drawn, start, ltr ? left : right);
    move(drawn, end, ltr ? right : left);
  });
  return drawn;
};

/** Every phone direction crossed with every app direction. */
export const PHONE_APP_PAIRS = Object.values(AppDirection).flatMap((phone) =>
  Object.values(AppDirection).map((app) => ({ phone, app }))
);
