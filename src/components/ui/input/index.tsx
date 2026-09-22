import type { Ref } from "react";
import type { TextInput } from "react-native";
import { Input as TamaguiInput, type InputProps, type TamaguiElement } from "tamagui";

import { useRTL } from "@/contexts/RTLContext";

type InputSize = "sm" | "md" | "lg";

/** Height and inset per size. Medium sits on the platform touch floor. */
const SIZE = {
  sm: { minHeight: "$9", paddingHorizontal: "$stack", fontSize: 14 },
  md: { minHeight: "$target", paddingHorizontal: "$group", fontSize: 16 },
  lg: { minHeight: "$12", paddingHorizontal: "$group", fontSize: 18 },
} as const;

type Props = Omit<InputProps, "size"> & {
  ref?: Ref<TextInput>;
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
      // Tamagui types the ref as TamaguiElement; the runtime instance is the RN
      // TextInput, so callers get the TextInput type for .focus().
      ref={ref as Ref<TamaguiElement>}
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
