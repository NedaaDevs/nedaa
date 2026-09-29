import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import type { TextSize } from "@/components/ui/text";
import { FONT_SIZES, SIZE_MAP } from "@/components/ui/text/sizing";

export type HostElement = ReturnType<typeof screen.getByText>;

/** The font size a size name renders at the default text preset. */
export const fontSizeOf = (size: TextSize): number => FONT_SIZES[SIZE_MAP[size]].fontSize;

/** A rendered element's style, flattened from RN's array-or-object form. */
export const styleOf = (element: HostElement) => StyleSheet.flatten(element.props.style);

/** A rendered text's line box as a multiple of its font size. */
export const lineRatioOf = (element: HostElement): number => {
  const { fontSize, lineHeight } = styleOf(element) ?? {};
  return Number(lineHeight) / Number(fontSize);
};
