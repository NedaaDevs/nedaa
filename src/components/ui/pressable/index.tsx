import { forwardRef } from "react";
import { styled, View } from "tamagui";
import type { GetProps } from "tamagui";

const PressableFrame = styled(View, {
  name: "Pressable",
  role: "button",
  minHeight: "$target",
  minWidth: "$target",
  pressStyle: {
    opacity: 0.7,
  },
  variants: {
    /** The tab bar sits above the platform floor; everything else sits on it. */
    target: {
      default: { minHeight: "$target", minWidth: "$target" },
      tab: { minHeight: "$targetTab", minWidth: "$targetTab" },
    },
    disabled: {
      true: {
        opacity: 0.4,
      },
    },
  } as const,
});

type PressableProps = GetProps<typeof PressableFrame>;

/**
 * `disabled` is a style variant, which Tamagui consumes rather than forwarding to the
 * view, so the handlers are dropped here too — otherwise the control dims to 40% and
 * still responds to touch.
 */
const Pressable = forwardRef<never, PressableProps>(
  ({ onPress, onLongPress, disabled, accessibilityState, ...props }, ref) => (
    <PressableFrame
      ref={ref}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      accessibilityState={{ disabled: Boolean(disabled), ...accessibilityState }}
      {...props}
    />
  )
);

Pressable.displayName = "Pressable";

export { Pressable };
export type { PressableProps };
