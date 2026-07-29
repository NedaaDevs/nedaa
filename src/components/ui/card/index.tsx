import { withStaticProperties } from "@tamagui/helpers";
import { styled, YStack } from "tamagui";
import type { GetProps } from "tamagui";

const CardFrame = styled(YStack, {
  name: "Card",
  backgroundColor: "$backgroundSecondary",
  borderRadius: "$6",
  padding: "$4",

  variants: {
    // Radius climbs with padding so a card reads at the same "softness" at any
    // size. md is the default and matches the grouped list radius.
    size: {
      sm: { padding: "$3", borderRadius: "$4" },
      md: { padding: "$4", borderRadius: "$6" },
      lg: { padding: "$6", borderRadius: "$7" },
    },
    variant: {
      // Flat surface. The default: surfaces separate from the page by radius and
      // a background step rather than by shadow.
      plain: {},
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
      // Inset-grouped list container: one surface holding rows that supply their
      // own padding, clipped so the first and last row inherit the corners.
      grouped: {
        padding: 0,
        borderRadius: "$6",
        overflow: "hidden",
      },
    },
  } as const,

  defaultVariants: {
    size: "md",
    variant: "plain",
  },
});

// Tappable card. Mirrors the `Pressable` primitive's touch behaviour so a
// hand-rolled `<Pressable>` surface swaps over without changing feel.
const CardPressable = styled(CardFrame, {
  name: "CardPressable",
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

// Hairline between rows of a `grouped` card. Pass `marginStart` to inset it so
// it aligns with the row's text rather than running full-bleed.
const CardDivider = styled(YStack, {
  name: "CardDivider",
  height: 1,
  backgroundColor: "$outline",
});

export const Card = withStaticProperties(CardFrame, {
  Pressable: CardPressable,
  Divider: CardDivider,
});

export type CardProps = GetProps<typeof CardFrame>;
export type CardPressableProps = GetProps<typeof CardPressable>;
