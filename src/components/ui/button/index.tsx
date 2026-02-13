import React from "react";
import { ActivityIndicator } from "react-native";
import {
  styled,
  View,
  XStack,
  YStack,
  Text as TamaguiText,
  createStyledContext,
  withStaticProperties,
  useTheme,
} from "tamagui";
import type { GetProps } from "tamagui";

type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
type ButtonVariant = "solid" | "outline" | "link";
type ButtonAction = "primary" | "secondary" | "positive" | "negative" | "default";

const ButtonContext = createStyledContext({
  size: "md" as ButtonSize,
  variant: "solid" as ButtonVariant,
  action: "primary" as ButtonAction,
});

const ICON_SIZE: Record<ButtonSize, number> = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 18,
  xl: 20,
};

const ACTION_THEME_KEY: Record<ButtonAction, string> = {
  primary: "primary",
  secondary: "secondary",
  positive: "success",
  negative: "error",
  default: "typography",
};

// --- ButtonFrame ---
// Variant order matters: action → size → variant → disabled
// Later variants override earlier ones on conflicting props.
// This lets `variant: outline/link` override action's backgroundColor.

const ButtonFrame = styled(View, {
  name: "Button",
  context: ButtonContext,
  role: "button",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "$2",
  borderRadius: "$4",
  pressStyle: {
    opacity: 0.8,
  },

  variants: {
    action: {
      primary: { backgroundColor: "$primary", borderColor: "$primary" },
      secondary: { backgroundColor: "$secondary", borderColor: "$secondary" },
      positive: { backgroundColor: "$success", borderColor: "$success" },
      negative: { backgroundColor: "$error", borderColor: "$error" },
      default: {
        backgroundColor: "transparent",
        borderColor: "transparent",
      },
    },
    size: {
      xs: { height: 32, paddingHorizontal: 14 },
      sm: { height: 36, paddingHorizontal: 16 },
      md: { height: 40, paddingHorizontal: 20 },
      lg: { height: 44, paddingHorizontal: 24 },
      xl: { height: 48, paddingHorizontal: 28 },
    },
    variant: {
      solid: { borderWidth: 0 },
      outline: { backgroundColor: "transparent", borderWidth: 1 },
      link: {
        backgroundColor: "transparent",
        borderWidth: 0,
        paddingHorizontal: 0,
      },
    },
    disabled: {
      true: { opacity: 0.4 },
    },
  } as const,

  defaultVariants: {
    action: "primary",
    variant: "solid",
    size: "md",
  },
});

// --- ButtonText ---
// Variant order: action sets text to action color, then variant:solid overrides to contrast white.

const ButtonTextFrame = styled(TamaguiText, {
  name: "ButtonText",
  context: ButtonContext,
  fontFamily: "$body",
  fontWeight: "600",

  variants: {
    action: {
      primary: { color: "$primary" },
      secondary: { color: "$secondary" },
      positive: { color: "$success" },
      negative: { color: "$error" },
      default: { color: "$typography" },
    },
    variant: {
      solid: { color: "$typographyContrast" },
      outline: {},
      link: {},
    },
    size: {
      xs: { fontSize: 10 },
      sm: { fontSize: 12 },
      md: { fontSize: 14 },
      lg: { fontSize: 16 },
      xl: { fontSize: 18 },
    },
  } as const,

  defaultVariants: {
    action: "primary",
    variant: "solid",
    size: "md",
  },
});

// --- ButtonIcon ---

type ButtonIconProps = {
  as: React.ComponentType<{ size?: number; color?: string }>;
  size?: number;
  color?: string;
};

const ButtonIcon: React.FC<ButtonIconProps> = ({
  as: IconComponent,
  size: sizeProp,
  color: colorProp,
}) => {
  const ctx = ButtonContext.useStyledContext();
  const theme = useTheme();

  const iconSize = sizeProp ?? ICON_SIZE[ctx.size ?? "md"];

  let resolvedColor: string;
  if (colorProp) {
    resolvedColor = colorProp;
  } else if (ctx.variant === "solid") {
    resolvedColor = theme.typographyContrast.val;
  } else {
    const key = ACTION_THEME_KEY[ctx.action ?? "primary"];
    resolvedColor = (theme as Record<string, { val: string }>)[key]?.val ?? theme.primary.val;
  }

  return <IconComponent size={iconSize} color={resolvedColor} />;
};
ButtonIcon.displayName = "ButtonIcon";

// --- ButtonSpinner ---

const ButtonSpinner: React.FC<{ color?: string }> = ({ color }) => {
  const ctx = ButtonContext.useStyledContext();
  const theme = useTheme();

  const resolvedColor =
    color ?? (ctx.variant === "solid" ? theme.typographyContrast.val : theme.primary.val);

  return <ActivityIndicator color={resolvedColor} />;
};
ButtonSpinner.displayName = "ButtonSpinner";

// --- ButtonGroup ---

type ButtonGroupProps = {
  children: React.ReactNode;
  space?: "xs" | "sm" | "md" | "lg" | "xl";
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  isAttached?: boolean;
};

const GAP_MAP: Record<string, string> = {
  xs: "$1",
  sm: "$2",
  md: "$3",
  lg: "$4",
  xl: "$5",
};

const ButtonGroup = React.forwardRef<any, ButtonGroupProps>(
  ({ space = "md", flexDirection = "column", isAttached = false, children }, ref) => {
    const isRow = flexDirection === "row" || flexDirection === "row-reverse";
    const Stack = isRow ? XStack : YStack;

    return (
      <Stack
        ref={ref}
        flexDirection={flexDirection}
        gap={isAttached ? "$0" : (GAP_MAP[space] as any)}>
        {children}
      </Stack>
    );
  }
);
ButtonGroup.displayName = "ButtonGroup";

// --- Compound export ---

const Button = withStaticProperties(ButtonFrame, {
  Text: ButtonTextFrame,
  Icon: ButtonIcon,
  Spinner: ButtonSpinner,
  Group: ButtonGroup,
});

type ButtonProps = GetProps<typeof ButtonFrame>;

export { Button, ButtonIcon, ButtonSpinner, ButtonGroup };
export type {
  ButtonProps,
  ButtonIconProps,
  ButtonGroupProps,
  ButtonSize,
  ButtonVariant,
  ButtonAction,
};
