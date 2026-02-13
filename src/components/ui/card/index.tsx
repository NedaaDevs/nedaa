import { styled, YStack } from "tamagui";

export const Card = styled(YStack, {
  name: "Card",
  backgroundColor: "$backgroundSecondary",
  borderRadius: "$4",
  padding: "$4",

  variants: {
    size: {
      sm: { padding: "$3", borderRadius: "$2" },
      md: { padding: "$4", borderRadius: "$4" },
      lg: { padding: "$6", borderRadius: "$8" },
    },
    variant: {
      elevated: {
        backgroundColor: "$backgroundSecondary",
        shadowColor: "$shadowColor",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      },
      outline: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: "$outline",
      },
      ghost: {
        backgroundColor: "transparent",
        borderRadius: 0,
      },
      filled: {
        backgroundColor: "$backgroundMuted",
      },
    },
  } as const,

  defaultVariants: {
    size: "md",
    variant: "elevated",
  },
});
