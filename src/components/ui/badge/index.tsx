import React from "react";
import { Platform } from "react-native";
import {
  styled,
  XStack,
  Text as TamaguiText,
  createStyledContext,
  withStaticProperties,
} from "tamagui";
import { useTheme } from "@/components/ui/theme-color";
import type { GetProps } from "tamagui";
import { resolveIconSize, type IconSize } from "@/components/ui/icon";
import { PlatformType } from "@/enums/app";
import { useTextScale } from "@/hooks/useTextScale";

type BadgeAction = "error" | "warning" | "success" | "info" | "muted";
type BadgeSize = "sm" | "md" | "lg";

const BadgeContext = createStyledContext({
  action: "muted" as BadgeAction,
  size: "md" as BadgeSize,
});

const ICON_SIZE: Record<BadgeSize, IconSize> = {
  sm: "2xs",
  md: "xs",
  lg: "sm",
};

const ACTION_THEME_KEY: Record<BadgeAction, string> = {
  error: "error",
  warning: "warning",
  success: "success",
  info: "accent",
  muted: "muted",
};

// --- BadgeFrame ---
// A borderless tint pill; `outline` keeps its name and draws the same.

const BadgeFrame = styled(XStack, {
  name: "Badge",
  context: BadgeContext,
  alignItems: "center",
  borderRadius: "$pill",
  borderWidth: 0,

  variants: {
    action: {
      error: {
        backgroundColor: "$backgroundError",
        borderColor: "$borderError",
      },
      warning: {
        backgroundColor: "$backgroundWarning",
        borderColor: "$borderWarning",
      },
      success: {
        backgroundColor: "$backgroundSuccess",
        borderColor: "$borderSuccess",
      },
      info: {
        backgroundColor: "$accentTint",
        borderColor: "$borderInfo",
      },
      muted: {
        backgroundColor: "$quietTint",
        borderColor: "$outline",
      },
    },
    variant: {
      solid: {},
      outline: {},
    },
    size: {
      sm: { paddingHorizontal: "$1.5", paddingVertical: "$0.5" },
      md: { paddingHorizontal: "$2.5", paddingVertical: "$0.5" },
      lg: { paddingHorizontal: "$3", paddingVertical: "$1" },
    },
  } as const,

  defaultVariants: {
    action: "muted",
    variant: "solid",
    size: "md",
  },
});

// --- BadgeText ---

const BadgeTextFrame = styled(TamaguiText, {
  name: "BadgeText",
  context: BadgeContext,
  fontFamily: "$body",
  fontWeight: "600",
  ...(Platform.OS === PlatformType.ANDROID && { paddingEnd: "$tight" }),

  variants: {
    action: {
      error: { color: "$error" },
      warning: { color: "$warning" },
      success: { color: "$success" },
      info: { color: "$accent" },
      muted: { color: "$muted" },
    },
    // Sizes carry no styles: BadgeText computes the label's fontSize from the
    // size context so the app text-scale can multiply it.
    size: {
      sm: {},
      md: {},
      lg: {},
    },
  } as const,
});

// Label font size per Badge size variant; the app text-scale multiplies it.
const BADGE_FONT_SIZE: Record<string, number> = { sm: 12, md: 12, lg: 12 };

type BadgeTextProps = GetProps<typeof BadgeTextFrame>;

const BadgeText = React.forwardRef<React.ComponentRef<typeof BadgeTextFrame>, BadgeTextProps>(
  ({ fontSize, ...props }, ref) => {
    const ctx = BadgeContext.useStyledContext();
    const m = useTextScale();
    const base =
      typeof fontSize === "number" ? fontSize : (BADGE_FONT_SIZE[ctx.size ?? "md"] ?? 12);
    return <BadgeTextFrame ref={ref} {...props} fontSize={base * m} allowFontScaling={false} />;
  }
);
BadgeText.displayName = "BadgeText";

// --- BadgeIcon ---

type BadgeIconProps = {
  as: React.ComponentType<{ size?: number; color?: string }>;
  size?: number;
};

const BadgeIcon: React.FC<BadgeIconProps> = ({ as: IconComponent, size: sizeProp }) => {
  const ctx = BadgeContext.useStyledContext();
  const theme = useTheme();

  const iconSize = sizeProp ?? ICON_SIZE[ctx.size ?? "md"];
  const key = ACTION_THEME_KEY[ctx.action ?? "muted"];
  const resolvedColor =
    (theme as Record<string, { val: string }>)[key]?.val ?? theme.typography.val;

  return <IconComponent size={resolveIconSize(iconSize)} color={resolvedColor} />;
};
BadgeIcon.displayName = "BadgeIcon";

// --- Compound export ---

const Badge = withStaticProperties(BadgeFrame, {
  Text: BadgeText,
  Icon: BadgeIcon,
});

type BadgeProps = GetProps<typeof BadgeFrame>;

export { Badge, BadgeIcon };
export type { BadgeProps, BadgeIconProps };
