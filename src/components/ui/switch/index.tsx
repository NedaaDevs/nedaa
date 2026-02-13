import React from "react";
import { Switch as TSwitch, useTheme, useThemeName } from "tamagui";

type SwitchSize = "sm" | "md" | "lg";

type SwitchProps = {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  size?: SwitchSize;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: any;
};

const SCALE: Record<SwitchSize, { transform: { scale: number }[] } | undefined> = {
  sm: { transform: [{ scale: 0.75 }] },
  md: undefined,
  lg: { transform: [{ scale: 1.25 }] },
};

const Switch = React.forwardRef<any, SwitchProps>(
  ({ value, onValueChange, size = "md", disabled, style, ...props }, ref) => {
    const theme = useTheme();
    const themeName = useThemeName();
    const isDark = themeName === "dark";

    return (
      <TSwitch
        ref={ref}
        native="mobile"
        checked={value}
        onCheckedChange={onValueChange}
        disabled={disabled}
        nativeProps={{
          trackColor: {
            false: theme.outline.val,
            true: theme.primary.val,
          },
          thumbColor: value
            ? isDark
              ? theme.background.val
              : theme.typographyContrast.val
            : theme.typographyContrast.val,
          ios_backgroundColor: theme.outline.val,
        }}
        style={[SCALE[size], disabled && { opacity: 0.4 }, style]}
        {...props}
      />
    );
  }
);

Switch.displayName = "Switch";
export { Switch };
export type { SwitchProps, SwitchSize };
