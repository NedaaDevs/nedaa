import type { Ref } from "react";
import type { TextInputInstance } from "react-native";
import { Input as TamaguiInput, type InputProps } from "tamagui";

import { useRTL } from "@/contexts/RTLContext";

type InputSize = "sm" | "md" | "lg";

/** Height and inset per size. Medium sits on the platform touch floor. */
const SIZE = {
  sm: { minHeight: "$9", paddingHorizontal: "$stack", fontSize: 14 },
  md: { minHeight: "$target", paddingHorizontal: "$group", fontSize: 16 },
  lg: { minHeight: "$12", paddingHorizontal: "$group", fontSize: 18 },
} as const;

type Props = Omit<InputProps, "size"> & {
  ref?: Ref<TextInputInstance>;
  size?: InputSize;
  invalid?: boolean;
};

/**
 * App-themed text input, mirrored for RTL so text and placeholder align to the
 * start side.
 */
export const Input = ({ ref, size = "md", invalid, disabled, ...props }: Props) => {
  const { isRTL } = useRTL();
  const metrics = SIZE[size];

  return (
    <TamaguiInput
      ref={ref}
      textAlign={isRTL ? "right" : "left"}
      minHeight={metrics.minHeight}
      paddingHorizontal={metrics.paddingHorizontal}
      fontSize={metrics.fontSize}
      borderRadius="$control"
      placeholderTextColor="$typographySecondary"
      borderColor={invalid ? "$error" : "$borderColor"}
      backgroundColor="$backgroundSecondary"
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      focusStyle={{ borderColor: invalid ? "$error" : "$primary" }}
      accessibilityState={{ disabled: Boolean(disabled) }}
      {...props}
    />
  );
};

export type { InputSize };
