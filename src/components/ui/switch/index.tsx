import React from "react";
import { Switch as TSwitch } from "tamagui";
import { useTheme } from "@/components/ui/theme-color";

type SwitchSize = "sm" | "md" | "lg";

type SwitchProps = {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  size?: SwitchSize;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: "switch";
  accessibilityState?: { checked?: boolean; disabled?: boolean };
  accessibilityHint?: string;
  style?: any;
};

const SCALE: Record<SwitchSize, { transform: { scale: number }[] } | undefined> = {
  sm: { transform: [{ scale: 0.75 }] },
  md: undefined,
  lg: { transform: [{ scale: 1.25 }] },
};

const Switch = React.forwardRef<any, SwitchProps>(
  ({ value, onValueChange, size = "md", disabled, style, ...accessibility }, ref) => {
    const theme = useTheme();

    // On a phone Tamagui renders the platform switch from `nativeProps` alone,
    // so its name, state and look travel there too.
    return (
      <TSwitch
        ref={ref}
        native="mobile"
        checked={value}
        onCheckedChange={onValueChange}
        disabled={disabled}
        nativeProps={{
          ...accessibility,
          disabled,
          style: [SCALE[size], disabled && { opacity: 0.4 }, style],
          trackColor: { false: theme.track.val, true: theme.accent.val },
          thumbColor: theme.thumb.val,
          ios_backgroundColor: theme.track.val,
        }}
      />
    );
  }
);

Switch.displayName = "Switch";
export { Switch };
export type { SwitchProps, SwitchSize };
