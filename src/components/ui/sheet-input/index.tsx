import type { ComponentRef, Ref } from "react";
import { StyleSheet, type TextInputProps } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { resolveTextSizing, sizeValuesOf, type TextSize } from "@/components/ui/text/sizing";
import { useTheme } from "@/components/ui/theme-color";

import { useRTL } from "@/contexts/RTLContext";
import { useTextScale } from "@/hooks/useTextScale";

type SheetInputVariant = "bare" | "boxed";

/** The Text size a field takes when its caller sets no font size. */
export const SHEET_INPUT_TEXT: TextSize = "md";

type Props = TextInputProps & {
  ref?: Ref<ComponentRef<typeof BottomSheetTextInput>>;
  /** `bare` sits inside a container that draws the border; `boxed` draws its own. */
  variant?: SheetInputVariant;
};

/**
 * Text input for a bottom sheet. It must be gorhom's own so it joins the sheet's
 * keyboard and gesture handling, and its colours resolve to values because the
 * native input takes no theme tokens.
 */
export const SheetInput = ({ ref, variant = "bare", multiline, style, ...props }: Props) => {
  const { isRTL } = useRTL();
  const theme = useTheme();
  // The caller's font size, or the field's own, scaled by Text's rule.
  const { fontSize } = resolveTextSizing(
    useTextScale(),
    StyleSheet.flatten(style)?.fontSize,
    sizeValuesOf(SHEET_INPUT_TEXT)
  );

  const boxed = variant === "boxed";

  return (
    <BottomSheetTextInput
      ref={ref}
      multiline={multiline}
      placeholderTextColor={theme.typographySecondary?.val}
      style={[
        {
          flex: boxed ? undefined : 1,
          color: theme.typography?.val,
          textAlign: isRTL ? "right" : "left",
          writingDirection: isRTL ? "rtl" : "ltr",
          padding: boxed ? 12 : 0,
        },
        boxed && {
          minHeight: multiline ? 88 : 44,
          borderWidth: 1,
          borderColor: theme.borderColor?.val,
          borderRadius: 12,
          textAlignVertical: multiline ? ("top" as const) : ("center" as const),
        },
        style,
        { fontSize },
      ]}
      {...props}
      allowFontScaling={false}
    />
  );
};

export type { SheetInputVariant };
