import React from "react";
import { Platform } from "react-native";
import { Text as TamaguiText, type TextProps as TamaguiTextProps, useTheme } from "tamagui";
import { AppLocale, PlatformType } from "@/enums/app";
import { FONT_SIZES, SIZE_MAP, resolveTextSizing } from "@/components/ui/text/sizing";
import { useTextScale } from "@/hooks/useTextScale";
import i18n from "@/localization/i18n";

type TextSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

// Arabic-script locales. Tracking these breaks cursive joins (CSS Text 3 §7.2.1),
// and React Native spaces glyphs uniformly with no cursive-elongation fallback.
const CURSIVE_LOCALES: readonly string[] = [AppLocale.AR, AppLocale.UR];

// Large type set at zero tracking reads untuned, so tighten as size grows.
// Keyed off the resolved pixel size so an explicit `fontSize` is covered too.
const resolveLetterSpacing = (fontSize: number | undefined): number | undefined => {
  if (fontSize == null || CURSIVE_LOCALES.includes(i18n.language)) return undefined;
  if (fontSize >= 48) return -1;
  if (fontSize >= 36) return -0.6;
  if (fontSize >= 30) return -0.4;
  if (fontSize >= 24) return -0.2;
  return undefined;
};

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
  /** Tabular figures, so digits keep a fixed advance width in aligned columns. */
  numeric?: boolean;
  /** Fixed multiplier for this instance, replacing the app preset (previews, share captures). */
  scaleOverride?: number;
};

const resolveFontWeight = (
  bold?: boolean,
  fontWeight?: TamaguiTextProps["fontWeight"]
): TamaguiTextProps["fontWeight"] => {
  if (bold) return "700";
  if (fontWeight) return fontWeight;
  return "400";
};

const IS_ANDROID = Platform.OS === PlatformType.ANDROID;

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
      numeric,
      scaleOverride,
      style,
      ...props
    },
    ref
  ) => {
    const theme = useTheme();
    // The hook always runs (hooks-order safety); the override only replaces its value.
    const appScale = useTextScale();
    const m = scaleOverride ?? appScale;
    const resolvedWeight = resolveFontWeight(bold, fontWeight);
    const tokenKey = SIZE_MAP[size] ?? "$3";
    const sizeValues = FONT_SIZES[tokenKey] ?? FONT_SIZES["$3"];
    const sized = resolveTextSizing(m, fontSize, sizeValues);

    return (
      <TamaguiText
        ref={ref}
        fontFamily="$body"
        fontWeight={resolvedWeight}
        color="$typography"
        letterSpacing={resolveLetterSpacing(sized.fontSize)}
        numberOfLines={isTruncated ? 1 : undefined}
        {...props}
        fontSize={sized.fontSize}
        lineHeight={sized.lineHeight}
        allowFontScaling={false}
        // Android mismeasures Arabic glyph widths; "simple" break strategy
        // uses a more generous width calculation in StaticLayout.
        {...(IS_ANDROID && { textBreakStrategy: "simple", paddingEnd: 8 })}
        style={[
          !IS_ANDROID && i18n.language === "ar" && { writingDirection: "rtl" as const },
          underline && { textDecorationLine: "underline" as const },
          strikeThrough && { textDecorationLine: "line-through" as const },
          italic && { fontStyle: "italic" as const },
          highlight && { backgroundColor: theme.backgroundWarning.val },
          sub && { fontSize: 12 * m },
          numeric && { fontVariant: ["tabular-nums" as const] },
          style,
        ]}
      />
    );
  }
);

Text.displayName = "Text";

export { Text };
export type { TextProps, TextSize };
