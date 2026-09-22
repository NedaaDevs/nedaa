import type { ComponentRef, Ref } from "react";
import type { TextInputProps } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useTheme } from "tamagui";

import { useRTL } from "@/contexts/RTLContext";

type SheetInputVariant = "bare" | "boxed";

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
      ]}
      {...props}
    />
  );
};

export type { SheetInputVariant };
