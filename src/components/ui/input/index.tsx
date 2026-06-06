import { Input as TamaguiInput, type InputProps } from "tamagui";

import { useRTL } from "@/contexts/RTLContext";

// App-themed text input. Mirrors for RTL — text *and* placeholder align to the
// start side (Arabic/Urdu read right-aligned) — and resolves text/placeholder/
// border/background from theme tokens so it reads correctly in light and dark
// without per-call styling. Callers can override any prop (e.g. a borderless
// search field passes backgroundColor="transparent" borderWidth={0}).
export const Input = (props: InputProps) => {
  const { isRTL } = useRTL();
  return (
    <TamaguiInput
      textAlign={isRTL ? "right" : "left"}
      color="$typography"
      placeholderTextColor="$typographySecondary"
      borderColor="$borderColor"
      backgroundColor="$backgroundSecondary"
      {...props}
    />
  );
};
