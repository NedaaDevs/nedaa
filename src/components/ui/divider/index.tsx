import { styled, Separator } from "tamagui";

export const Divider = styled(Separator, {
  name: "Divider",
  borderColor: "$outline",

  variants: {
    orientation: {
      horizontal: {
        width: "100%",
        borderBottomWidth: 1,
      },
      vertical: {
        height: "100%",
        borderRightWidth: 1,
      },
    },
  } as const,

  defaultVariants: {
    orientation: "horizontal",
  },
});
