import type { Ref } from "react";
import type { TextInput } from "react-native";
import { Input as TamaguiInput, type InputProps, type TamaguiElement } from "tamagui";

import { useRTL } from "@/contexts/RTLContext";

// App-themed text input. Mirrors for RTL — text *and* placeholder align to the
// start side (Arabic/Urdu read right-aligned) — and resolves text/placeholder/
// border/background from theme tokens so it reads correctly in light and dark
// without per-call styling. Callers can override any prop (e.g. a borderless
// search field passes backgroundColor="transparent" borderWidth={0}).
export const Input = ({ ref, ...props }: InputProps & { ref?: Ref<TextInput> }) => {
  const { isRTL } = useRTL();
  return (
    <TamaguiInput
      // Tamagui types the ref as TamaguiElement; the runtime instance is the RN
      // TextInput, so we expose the TextInput type to callers (for .focus()).
      ref={ref as Ref<TamaguiElement>}
      textAlign={isRTL ? "right" : "left"}
      color="$typography"
      placeholderTextColor="$typographySecondary"
      borderColor="$borderColor"
      backgroundColor="$backgroundSecondary"
      {...props}
    />
  );
};
