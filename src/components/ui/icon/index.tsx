import React from "react";
import { View as RNView, type ViewProps } from "react-native";
import { Mail } from "lucide-react-native";

import { ICON_SIZES, resolveIconSize, type IconSize } from "@/components/ui/icon/sizing";
import { useThemeColor } from "@/components/ui/theme-color";

type IconProps = {
  as: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;
  size?: IconSize | number;
  color?: string;
  /** Paints the glyph's inside; a `$key` names a theme colour. */
  fill?: string;
  strokeWidth?: number;
  style?: ViewProps["style"];
  accessibilityLabel?: string;
};

const Icon = React.forwardRef<any, IconProps>(
  (
    {
      as: IconComponent,
      size = "md",
      color,
      fill,
      strokeWidth,
      style,
      accessibilityLabel,
      ...props
    },
    _ref
  ) => {
    const resolvedSize = resolveIconSize(size);
    const resolvedColor = useThemeColor(color ?? "$typography");
    const resolvedFill = useThemeColor(fill ?? "none");

    const isDecorative = !accessibilityLabel;

    const a11yProps = isDecorative
      ? { accessibilityElementsHidden: true, importantForAccessibility: "no" as const }
      : { accessibilityLabel, accessibilityRole: "image" as const };

    const icon = (
      <IconComponent
        size={resolvedSize}
        color={resolvedColor}
        strokeWidth={strokeWidth}
        {...(fill ? { fill: resolvedFill } : null)}
        {...props}
      />
    );

    if (style || !isDecorative) {
      return (
        <RNView style={style} {...a11yProps}>
          {icon}
        </RNView>
      );
    }

    return <RNView {...a11yProps}>{icon}</RNView>;
  }
);

Icon.displayName = "Icon";

const MailIcon = Mail;

export { Icon, MailIcon };
export { ICON_SIZES, resolveIconSize };
export type { IconProps, IconSize };
