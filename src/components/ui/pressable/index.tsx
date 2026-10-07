import { forwardRef } from "react";
import type { View as NativeView } from "react-native";
import { styled, View } from "tamagui";
import type { GetProps } from "tamagui";

const PressableFrame = styled(View, {
  name: "Pressable",
  // A View carrying a role is not yet an accessibility element.
  accessible: true,
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

// Tamagui's native press handler reads `delayLongPress` but leaves it off the view's props.
type PressableProps = GetProps<typeof PressableFrame> & { delayLongPress?: number };

/**
 * `disabled` is a style variant, which Tamagui consumes rather than forwarding to the
 * view, so the handlers are dropped here too — otherwise the control dims to 40% and
 * still responds to touch.
 */
// The ref is the native view, so a sheet can hand reader focus back to it.
const Pressable = forwardRef<NativeView, PressableProps>(
  ({ onPress, onLongPress, disabled, accessibilityState, role, ...props }, ref) => (
    <PressableFrame
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

Pressable.displayName = "Pressable";

export { Pressable };
export type { PressableProps };
