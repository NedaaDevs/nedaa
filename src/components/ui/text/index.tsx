import React from "react";
import { Text as TamaguiText, type TextProps as TamaguiTextProps } from "tamagui";

// Font size + line height mapping (from tamagui.config.ts font definitions).
// We resolve sizes to numeric values directly because Android's Fabric renderer
// rejects string token values for fontSize on RCTText.
const FONT_SIZES: Record<string, { fontSize: number; lineHeight: number }> = {
  $1: { fontSize: 10, lineHeight: 14 },
  $2: { fontSize: 12, lineHeight: 16 },
  $3: { fontSize: 14, lineHeight: 20 },
  $4: { fontSize: 16, lineHeight: 24 },
  $5: { fontSize: 18, lineHeight: 28 },
  $6: { fontSize: 20, lineHeight: 28 },
  $7: { fontSize: 24, lineHeight: 32 },
  $8: { fontSize: 30, lineHeight: 36 },
  $9: { fontSize: 36, lineHeight: 40 },
  $10: { fontSize: 48, lineHeight: 48 },
};

const SIZE_MAP: Record<string, string> = {
  "2xs": "$1",
  xs: "$1",
  sm: "$2",
  md: "$3",
  lg: "$4",
  xl: "$5",
  "2xl": "$6",
  "3xl": "$7",
  "4xl": "$8",
  "5xl": "$9",
};

type TextSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

type TextProps = TamaguiTextProps & {
  bold?: boolean;
  fontWeight?: TamaguiTextProps["fontWeight"];
  isTruncated?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  sub?: boolean;
  italic?: boolean;
  highlight?: boolean;
  size?: TextSize;
};

const resolveFontWeight = (
  bold?: boolean,
  fontWeight?: TamaguiTextProps["fontWeight"]
): TamaguiTextProps["fontWeight"] => {
  if (bold) return "700";
  if (fontWeight) return fontWeight;
  return "400";
};

const resolveFontSize = (value: any): number | undefined => {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.startsWith("$")) {
    return FONT_SIZES[value]?.fontSize;
  }
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};

const Text = React.forwardRef<React.ComponentRef<typeof TamaguiText>, TextProps>(
  (
    {
      bold,
      fontWeight,
      fontSize,
      isTruncated,
      underline,
      strikeThrough,
      sub,
      italic,
      highlight,
      size = "md",
      style,
      ...props
    },
    ref
  ) => {
    const resolvedWeight = resolveFontWeight(bold, fontWeight);
    const tokenKey = SIZE_MAP[size] ?? "$3";
    const sizeValues = FONT_SIZES[tokenKey] ?? FONT_SIZES["$3"];
    const resolvedFontSize = fontSize != null ? resolveFontSize(fontSize) : sizeValues.fontSize;

    return (
      <TamaguiText
        ref={ref}
        fontFamily="$body"
        fontWeight={resolvedWeight}
        color="$typography"
        numberOfLines={isTruncated ? 1 : undefined}
        {...props}
        fontSize={resolvedFontSize}
        lineHeight={fontSize != null ? undefined : sizeValues.lineHeight}
        style={[
          underline && { textDecorationLine: "underline" as const },
          strikeThrough && { textDecorationLine: "line-through" as const },
          italic && { fontStyle: "italic" as const },
          highlight && { backgroundColor: "$backgroundWarning" },
          sub && { fontSize: 12 },
          style,
        ]}
      />
    );
  }
);

Text.displayName = "Text";

export { Text };
export type { TextProps, TextSize };
