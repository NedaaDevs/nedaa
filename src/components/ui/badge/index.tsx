import React from "react";
import {
  styled,
  XStack,
  Text as TamaguiText,
  createStyledContext,
  withStaticProperties,
  useTheme,
} from "tamagui";
import type { GetProps } from "tamagui";

type BadgeAction = "error" | "warning" | "success" | "info" | "muted";
type BadgeSize = "sm" | "md" | "lg";

const BadgeContext = createStyledContext({
  action: "muted" as BadgeAction,
  size: "md" as BadgeSize,
});

const ICON_SIZE: Record<BadgeSize, number> = {
  sm: 12,
  md: 14,
  lg: 16,
};

const ACTION_THEME_KEY: Record<BadgeAction, string> = {
  error: "error",
  warning: "warning",
  success: "success",
  info: "info",
  muted: "typography",
};

// --- BadgeFrame ---
// borderColor is set per action but only visible when variant=outline adds borderWidth.

const BadgeFrame = styled(XStack, {
  name: "Badge",
  context: BadgeContext,
  alignItems: "center",
  borderRadius: "$1",

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
        backgroundColor: "$backgroundInfo",
        borderColor: "$borderInfo",
      },
      muted: {
        backgroundColor: "$backgroundMuted",
        borderColor: "$outline",
      },
    },
    variant: {
      solid: { borderWidth: 0 },
      outline: { borderWidth: 1 },
    },
    size: {
      sm: { paddingHorizontal: "$1", paddingVertical: 2 },
      md: { paddingHorizontal: "$2", paddingVertical: "$1" },
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
  fontWeight: "400",
  textTransform: "uppercase",

  variants: {
    action: {
      error: { color: "$error" },
      warning: { color: "$warning" },
      success: { color: "$success" },
      info: { color: "$info" },
      muted: { color: "$typography" },
    },
    size: {
      sm: { fontSize: 10 },
      md: { fontSize: 10 },
      lg: { fontSize: 12 },
    },
  } as const,
});

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

  return <IconComponent size={iconSize} color={resolvedColor} />;
};
BadgeIcon.displayName = "BadgeIcon";

// --- Compound export ---

const Badge = withStaticProperties(BadgeFrame, {
  Text: BadgeTextFrame,
  Icon: BadgeIcon,
});

type BadgeProps = GetProps<typeof BadgeFrame>;

export { Badge, BadgeIcon };
export type { BadgeProps, BadgeIconProps };
