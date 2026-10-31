import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import type { TextSize } from "@/components/ui/text";
import { FONT_SIZES, SIZE_MAP } from "@/components/ui/text/sizing";

export type HostElement = ReturnType<typeof screen.getByText>;

/** The font size a size name renders at the default text preset. */
export const fontSizeOf = (size: TextSize): number => FONT_SIZES[SIZE_MAP[size]].fontSize;

/** A rendered element's style, flattened from RN's array-or-object form. */
export const styleOf = (element: HostElement) => StyleSheet.flatten(element.props.style);

/** An element and every host element under it, in tree order. */
export const hostNodesIn = (element: HostElement): HostElement[] => [
  element,
  ...element.children.flatMap((child) => (typeof child === "string" ? [] : hostNodesIn(child))),
];

/** The room an element has at its end, as Android adds it to running text. */
export const endRoomOf = (element: HostElement): number => {
  const room = styleOf(element)?.paddingEnd;
  return typeof room === "number" ? room : 0;
};

/** A rendered text's line box as a multiple of its font size. */
export const lineRatioOf = (element: HostElement): number => {
  const { fontSize, lineHeight } = styleOf(element) ?? {};
  return Number(lineHeight) / Number(fontSize);
};
