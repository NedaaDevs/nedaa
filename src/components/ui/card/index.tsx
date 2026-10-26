import { forwardRef } from "react";
import { withStaticProperties } from "@tamagui/helpers";
import { styled, YStack } from "tamagui";
import type { GetProps, TamaguiElement } from "tamagui";

import { useRestingSurface } from "@/components/ui/material/edge";
import { usePressScale } from "@/components/ui/pressable/pressScale";

const CardFrame = styled(YStack, {
  name: "Card",
  backgroundColor: "$surfaceGlass",
  borderRadius: "$card",
  padding: "$cardPad",

  variants: {
    // Size changes the inset, not the shape: a card is a card at any size. The
    // small one reads as a chip, which is its own intent.
    size: {
      sm: { padding: "$stack", borderRadius: "$chip" },
      md: { padding: "$cardPad", borderRadius: "$card" },
      // 24 has no named step; the vocabulary stops at section (20).
      lg: { padding: "$6", borderRadius: "$card" },
    },
    variant: {
      // The resting surface: a glass tone, the e1 lift and a lit top edge.
      plain: {},
      // Every resting card carries the e1 lift, so this rests like `plain`.
      elevated: {},
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
      // Nested in a sheet: the thinned panel tone; glass never lies on glass.
      panel: {
        backgroundColor: "$panel",
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

type CardVariant = NonNullable<GetProps<typeof CardFrame>["variant"]>;
type CardRestProps = Pick<
  GetProps<typeof CardFrame>,
  "testID" | "size" | "borderRadius" | "variant"
>;

/** Transparent and nested cards draw no lift and no lit edge. */
const RESTS: Record<CardVariant, boolean> = {
  plain: true,
  elevated: true,
  outline: false,
  ghost: false,
  filled: true,
  panel: false,
  grouped: true,
};

/** The resting look on the card's own corner; null for a card that lies flat. */
const useCardRest = ({ testID, size, borderRadius, variant }: CardRestProps) => {
  const resting = useRestingSurface({
    owner: testID,
    radius: borderRadius ?? (size === "sm" ? "$chip" : "$card"),
  });
  return RESTS[variant ?? "plain"] ? resting : null;
};

const RestingCard = forwardRef<TamaguiElement, GetProps<typeof CardFrame>>(
  ({ children, style, ...props }, ref) => {
    const rest = useCardRest(props);
    return (
      <CardFrame ref={ref} {...props} style={rest ? [rest.lift, style] : style}>
        {rest?.edge}
        {children}
      </CardFrame>
    );
  }
);
RestingCard.displayName = "Card";

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
  (
    {
      onPress,
      onLongPress,
      disabled,
      accessibilityState,
      role,
      children,
      style,
      pressStyle,
      ...props
    },
    ref
  ) => {
    const rest = useCardRest(props);
    const press = usePressScale();
    return (
      <CardPressableFrame
        ref={ref}
        transition={press.transition}
        animateOnly={press.animateOnly}
        pressStyle={{ ...press.pressStyle, ...pressStyle }}
        // A button unless the caller names a role; `role` would override theirs.
        role={role ?? (props.accessibilityRole ? undefined : "button")}
        disabled={disabled}
        onPress={disabled ? undefined : onPress}
        onLongPress={disabled ? undefined : onLongPress}
        accessibilityState={{ disabled: Boolean(disabled), ...accessibilityState }}
        {...props}
        style={rest ? [rest.lift, style] : style}>
        {rest?.edge}
        {children}
      </CardPressableFrame>
    );
  }
);
CardPressable.displayName = "CardPressable";

// Hairline between rows of a `grouped` card. Pass `marginStart` to inset it so
// it aligns with the row's text rather than running full-bleed.
const CardDivider = styled(YStack, {
  name: "CardDivider",
  height: 1,
  backgroundColor: "$hairline",
});

export const Card = withStaticProperties(RestingCard, {
  Pressable: CardPressable,
  Divider: CardDivider,
});

export type CardProps = GetProps<typeof CardFrame>;
export type CardPressableProps = GetProps<typeof CardPressableFrame>;
