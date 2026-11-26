import React from "react";
import { I18nManager, Platform, type StyleProp, type ViewStyle } from "react-native";
import { Switch as TSwitch } from "tamagui";
import { useTheme } from "@/components/ui/theme-color";
import { useRTL } from "@/contexts/RTLContext";
import { PlatformType } from "@/enums/app";

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
  testID?: string;
  style?: StyleProp<Omit<ViewStyle, "transform">>;
};

const SCALE: Record<SwitchSize, number> = { sm: 0.75, md: 1, lg: 1.25 };

// iOS draws the UISwitch by the phone's direction; Android by the app's.
const drawsAgainstApp = (appIsRTL: boolean) =>
  Platform.OS === PlatformType.IOS && appIsRTL !== I18nManager.isRTL;

const Switch = React.forwardRef<any, SwitchProps>(
  ({ value, onValueChange, size = "md", disabled, style, ...nativeOnly }, ref) => {
    const theme = useTheme();
    const { isRTL } = useRTL();
    const mirror = drawsAgainstApp(isRTL) ? -1 : 1;

    // On a phone Tamagui renders the platform switch from `nativeProps` alone,
    // so its name, state, testID and look travel there too.
    return (
      <TSwitch
        ref={ref}
        native="mobile"
        checked={value}
        onCheckedChange={onValueChange}
        disabled={disabled}
        nativeProps={{
          ...nativeOnly,
          disabled,
          style: [
            { transform: [{ scale: SCALE[size] }, { scaleX: mirror }] },
            disabled && { opacity: 0.4 },
            style,
          ],
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
