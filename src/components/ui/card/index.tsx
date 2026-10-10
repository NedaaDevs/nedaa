import { forwardRef } from "react";
import { withStaticProperties } from "@tamagui/helpers";
import { styled, YStack } from "tamagui";
import type { GetProps } from "tamagui";

const CardFrame = styled(YStack, {
  name: "Card",
  backgroundColor: "$backgroundSecondary",
  borderRadius: "$card",
  padding: "$group",

  variants: {
    // Size changes the inset, not the shape: a card is a card at any size. The
    // small one reads as a chip, which is its own intent.
    size: {
      sm: { padding: "$stack", borderRadius: "$chip" },
      md: { padding: "$group", borderRadius: "$card" },
      // 24 has no named step; the vocabulary stops at section (20).
      lg: { padding: "$6", borderRadius: "$card" },
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
        borderRadius: "$card",
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
const CardPressableFrame = styled(CardFrame, {
  name: "CardPressable",
  // A View carrying a role is not yet an accessibility element.
  accessible: true,
  minHeight: "$target",
  minWidth: "$target",
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

/** Same reason as the `Pressable` primitive: the `disabled` variant only dims. */
const CardPressable = forwardRef<never, GetProps<typeof CardPressableFrame>>(
  ({ onPress, onLongPress, disabled, accessibilityState, role, ...props }, ref) => (
    <CardPressableFrame
      ref={ref}
      // A button unless the caller names a role; `role` would override theirs.
      role={role ?? (props.accessibilityRole ? undefined : "button")}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      accessibilityState={{ disabled: Boolean(disabled), ...accessibilityState }}
      {...props}
    />
  )
);
CardPressable.displayName = "CardPressable";

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
export type CardPressableProps = GetProps<typeof CardPressableFrame>;
