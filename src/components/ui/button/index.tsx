import React from "react";
import { ActivityIndicator, Platform } from "react-native";
import { PlatformType } from "@/enums/app";
import { buttonLabelFontSize } from "@/components/ui/button/sizing";
import { useTextScale } from "@/hooks/useTextScale";
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
        backgroundColor: "$backgroundMuted",
        borderColor: "$backgroundMuted",
      },
    },
    // minHeight, not height: the box is a floor that grows with a scaled or
    // wrapped label instead of clipping it.
    size: {
      xs: { minHeight: 32, paddingVertical: 4, paddingHorizontal: 14 },
      sm: { minHeight: 36, paddingVertical: 4, paddingHorizontal: 16 },
      md: { minHeight: 40, paddingVertical: 4, paddingHorizontal: 20 },
      lg: { minHeight: 44, paddingVertical: 4, paddingHorizontal: 24 },
      xl: { minHeight: 48, paddingVertical: 4, paddingHorizontal: 28 },
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
  ...(Platform.OS === PlatformType.ANDROID && { paddingEnd: 8, textBreakStrategy: "simple" }),

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
    // The size variant carries no styles: ButtonText computes the label's
    // fontSize from the size context so the app text-scale can multiply it.
    size: {
      xs: {},
      sm: {},
      md: {},
      lg: {},
      xl: {},
    },
  } as const,

  defaultVariants: {
    action: "primary",
    variant: "solid",
    size: "md",
  },
});

// The public Button.Text: applies the app text-scale to the size variant's
// label font and keeps OS font scaling off (the app owns text size).
type ButtonTextProps = GetProps<typeof ButtonTextFrame> & { scaleOverride?: number };

const ButtonText = React.forwardRef<React.ComponentRef<typeof ButtonTextFrame>, ButtonTextProps>(
  ({ fontSize, size, scaleOverride, ...props }, ref) => {
    const ctx = ButtonContext.useStyledContext();
    // The hook always runs (hooks-order safety); the override only replaces its value.
    const appScale = useTextScale();
    const m = scaleOverride ?? appScale;
    // The label's own size prop wins over the Button's size context.
    const sizeKey = typeof size === "string" ? size : ctx.size;
    return (
      <ButtonTextFrame
        ref={ref}
        {...props}
        fontSize={buttonLabelFontSize(sizeKey, fontSize, m)}
        allowFontScaling={false}
      />
    );
  }
);
ButtonText.displayName = "ButtonText";

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
  Text: ButtonText,
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
