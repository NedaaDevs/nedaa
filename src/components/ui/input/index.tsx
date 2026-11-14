import type { Ref } from "react";
import type { TextInputInstance } from "react-native";
import { Input as TamaguiInput, type InputProps } from "tamagui";

import { resolveTextSizing, sizeValuesOf } from "@/components/ui/text/sizing";
import { useRTL } from "@/contexts/RTLContext";
import { useTextScale } from "@/hooks/useTextScale";

/** Height, inset and Text size per size; md sits on the touch floor. */
export const INPUT_SIZE = {
  sm: { minHeight: "$9", paddingHorizontal: "$stack", text: "md" },
  md: { minHeight: "$target", paddingHorizontal: "$group", text: "lg" },
  lg: { minHeight: "$12", paddingHorizontal: "$group", text: "xl" },
} as const;

type InputSize = keyof typeof INPUT_SIZE;

/** A single-line box grows with its line and drops Android's theme inset. */
const SINGLE_LINE_BOX = { height: "auto", paddingVertical: "$0" } as const;

type Props = Omit<InputProps, "size"> & {
  ref?: Ref<TextInputInstance>;
  size?: InputSize;
  invalid?: boolean;
};

/** Themed input: text aligns to the start side and scales as Text does. */
export const Input = ({ ref, size = "md", invalid, disabled, fontSize, ...props }: Props) => {
  const { isRTL } = useRTL();
  const metrics = INPUT_SIZE[size];
  const sized = resolveTextSizing(useTextScale(), fontSize, sizeValuesOf(metrics.text));

  return (
    <TamaguiInput
      ref={ref}
      textAlign={isRTL ? "right" : "left"}
      minHeight={metrics.minHeight}
      paddingHorizontal={metrics.paddingHorizontal}
      fontSize={sized.fontSize}
      borderRadius="$control"
      placeholderTextColor="$typographySecondary"
      borderColor={invalid ? "$error" : "$borderColor"}
      backgroundColor="$backgroundSecondary"
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      focusStyle={{ borderColor: invalid ? "$error" : "$primary" }}
      accessibilityState={{ disabled: Boolean(disabled) }}
      {...(props.multiline ? null : SINGLE_LINE_BOX)}
      {...props}
      allowFontScaling={false}
    />
  );
};

export type { InputSize };
