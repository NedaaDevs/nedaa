import { styled, View } from "tamagui";

// A filled 1pt box, not a border on a zero-height one: only a box with its own
// height counts toward its parent's size.
export const Divider = styled(View, {
  name: "Divider",
  backgroundColor: "$border",
  flexShrink: 0,

  variants: {
    orientation: {
      horizontal: {
        height: 1,
        alignSelf: "stretch",
      },
      vertical: {
        width: 1,
        alignSelf: "stretch",
      },
    },
  } as const,

  defaultVariants: {
    orientation: "horizontal",
  },
});
