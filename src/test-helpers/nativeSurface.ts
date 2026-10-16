import type { ViewStyle } from "react-native";

import { AppDirection } from "@/enums/app";

// Fabric's swapLeftAndRightInYogaStyleProps: on an RTL native surface each
// physical edge becomes its logical twin, resolved by the inherited direction.
const SWAPS = [
  ["left", "start"],
  ["right", "end"],
  ["marginLeft", "marginStart"],
  ["marginRight", "marginEnd"],
  ["paddingLeft", "paddingStart"],
  ["paddingRight", "paddingEnd"],
] as const;

/** A style as React Native hands it to Yoga on a phone read in `phone`. */
export const onPhone = (style: ViewStyle, phone: AppDirection): ViewStyle => {
  if (phone === AppDirection.LTR) return style;
  const swapped: ViewStyle = { ...style };
  SWAPS.forEach(([physical, logical]) => {
    if (style[physical] === undefined) return;
    swapped[logical] = style[physical];
    delete swapped[physical];
  });
  return swapped;
};

/** Every phone direction crossed with every app direction. */
export const PHONE_APP_PAIRS = Object.values(AppDirection).flatMap((phone) =>
  Object.values(AppDirection).map((app) => ({ phone, app }))
);
