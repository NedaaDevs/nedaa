import type { ComponentType } from "react";
import {
  Rect as RNRect,
  Text as RNText,
  type NumberArray,
  type NumberProp,
  type RectProps,
  type TextProps,
} from "react-native-svg";

// <Rect> and <Text> re-exported with their true geometry contracts.
//
// On these two elements `x` and `y` are SVG geometry attributes — position in
// the parent coordinate system — and react-native-svg does not deprecate them.
// Rect passes them through withoutXY and Text passes `x: null, y: null` into
// extractProps, so on neither element do they reach the transform path.
//
// The @deprecated tag still shows up on them because RectProps and TextProps
// extend TransformProps, which deprecates its own transform-shorthand `x`/`y`,
// and TypeScript propagates a base member's JSDoc to a derived member that
// redeclares it. Omit drops the leaked tag together with the original member.
//
// Re-check on a react-native-svg major bump: this also hides a genuine future
// deprecation of Rect.x or Text.x, should upstream ever add one.

type GeometryRectProps = Omit<RectProps, "x" | "y"> & {
  x?: NumberProp;
  y?: NumberProp;
};

type GeometryTextProps = Omit<TextProps, "x" | "y"> & {
  x?: NumberArray;
  y?: NumberArray;
};

export const Rect: ComponentType<GeometryRectProps> = RNRect;
export const Text: ComponentType<GeometryTextProps> = RNText;
