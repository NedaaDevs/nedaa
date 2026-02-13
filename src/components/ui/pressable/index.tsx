import { styled, View } from "tamagui";
import type { GetProps } from "tamagui";

const Pressable = styled(View, {
  name: "Pressable",
  role: "button",
  minHeight: 44,
  minWidth: 44,
  pressStyle: {
    opacity: 0.7,
  },
  variants: {
    disabled: {
      true: {
        opacity: 0.4,
      },
    },
  } as const,
});

type PressableProps = GetProps<typeof Pressable>;

export { Pressable };
export type { PressableProps };
