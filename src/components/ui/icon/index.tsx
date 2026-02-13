import React from "react";
import { View as RNView, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "tamagui";
import { Mail } from "lucide-react-native";

type IconSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<IconSize, number> = {
  "2xs": 12,
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
};

type IconProps = {
  as: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  size?: IconSize | number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

const Icon = React.forwardRef<any, IconProps>(
  ({ as: IconComponent, size = "md", color, strokeWidth, style, ...props }, _ref) => {
    const theme = useTheme();

    const resolvedSize = typeof size === "number" ? size : (SIZE_MAP[size] ?? 18);

    const resolvedColor = color
      ? color.startsWith("$")
        ? ((theme as Record<string, { val: string }>)[color.slice(1)]?.val ?? color)
        : color
      : theme.typography.val;

    const icon = (
      <IconComponent
        size={resolvedSize}
        color={resolvedColor}
        strokeWidth={strokeWidth}
        {...props}
      />
    );

    if (style) {
      return <RNView style={style}>{icon}</RNView>;
    }

    return icon;
  }
);

Icon.displayName = "Icon";

const MailIcon = Mail;

export { Icon, MailIcon };
export type { IconProps, IconSize };
