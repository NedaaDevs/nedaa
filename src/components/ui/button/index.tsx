import React from "react";
import { ActivityIndicator, Platform } from "react-native";
import { resolveIconSize, type IconSize } from "@/components/ui/icon";
import { PlatformType } from "@/enums/app";
import { buttonLabelFontSize } from "@/components/ui/button/sizing";
import { useTextScale } from "@/hooks/useTextScale";
import {
  getTokenValue,
  styled,
  View,
  XStack,
  YStack,
  Text as TamaguiText,
  createStyledContext,
  withStaticProperties,
} from "tamagui";
import { useTheme, useThemeColor } from "@/components/ui/theme-color";
import type { GetProps } from "tamagui";

type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
type ButtonVariant = "solid" | "outline" | "link";
type ButtonAction = "primary" | "secondary" | "positive" | "negative" | "default";

const ButtonContext = createStyledContext({
  size: "md" as ButtonSize,
  variant: "solid" as ButtonVariant,
  action: "primary" as ButtonAction,
});

/** No size step is 50; the default button stands this high. */
const DEFAULT_HEIGHT = 50;

/**
 * Each size's drawn height, rising with the name; below `$target`, a touch area
 * makes up the rest. Sticky action bars and footers carry `lg`.
 */
const MIN_HEIGHT = {
  xs: "$8",
  sm: "$9",
  md: DEFAULT_HEIGHT,
  lg: "$14",
  xl: "$16",
} as const satisfies Record<ButtonSize, string | number>;

const heightOf = (size: ButtonSize): number => {
  const height = MIN_HEIGHT[size];
  return typeof height === "number" ? height : getTokenValue(height, "size");
};

const touchSlop = (size: ButtonSize) => {
  const short = getTokenValue("$target", "size") - heightOf(size);
  return short > 0 ? { top: short / 2, bottom: short / 2 } : undefined;
};

const ICON_SIZE: Record<ButtonSize, IconSize> = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "md",
  xl: "lg",
};

const ACTION_INK = {
  primary: "accent",
  secondary: "secondary",
  positive: "success",
  negative: "error",
  default: "typography",
} as const satisfies Record<ButtonAction, string>;

type InkKey = (typeof ACTION_INK)[ButtonAction] | "accentText" | "bg" | "fg" | "typographyContrast";

/** The label's and icon's theme key: a filled button inks in its fill's contrast. */
const inkKey = (action: ButtonAction, variant: ButtonVariant): InkKey => {
  if (variant === "solid") return action === "primary" ? "bg" : "typographyContrast";
  if (variant === "outline" && action === "primary") return "fg";
  // A text button's label, icon and spinner share the accent made for text.
  if (variant === "link" && action === "primary") return "accentText";
  return ACTION_INK[action];
};

/** An outline's inset ring: a hairline, or the tone of a status action. */
const RING = {
  primary: "$hairline",
  secondary: "$hairline",
  positive: "$success",
  negative: "$error",
  default: "$hairline",
} as const satisfies Record<ButtonAction, string>;

/** The primary call to action glows; the outline takes an inset ring and a lit edge. */
const useButtonShadow = (action: ButtonAction, variant: ButtonVariant): string | undefined => {
  const glow = useThemeColor("$accentGlow");
  const ring = useThemeColor(RING[action]);
  const highlight = useThemeColor("$highlight");
  if (variant === "outline") return `inset 0 0 0 1px ${ring}, inset 0 1px 0 ${highlight}`;
  if (variant === "solid" && action === "primary") return `0 8px 20px ${glow}`;
  return undefined;
};

// --- ButtonFrame ---
// Variant order matters: action → size → variant → disabled
// Later variants override earlier ones on conflicting props.
// This lets `variant: outline/link` override action's backgroundColor.

const ButtonFrame = styled(View, {
  name: "Button",
  context: ButtonContext,
  role: "button",
  // A View carrying a role is not yet an accessibility element.
  accessible: true,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "$inline",
  borderRadius: "$control",
  pressStyle: {
    opacity: 0.8,
  },

  variants: {
    action: {
      primary: { backgroundColor: "$accent", borderColor: "$accent" },
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
      // The inset is the button's own step, never a gap name.
      xs: { minHeight: MIN_HEIGHT.xs, paddingVertical: "$1", paddingHorizontal: "$3.5" },
      sm: { minHeight: MIN_HEIGHT.sm, paddingVertical: "$1", paddingHorizontal: "$4" },
      md: { minHeight: MIN_HEIGHT.md, paddingVertical: "$1", paddingHorizontal: "$5" },
      lg: { minHeight: MIN_HEIGHT.lg, paddingVertical: "$1", paddingHorizontal: "$6" },
      xl: { minHeight: MIN_HEIGHT.xl, paddingVertical: "$1", paddingHorizontal: "$7" },
    },
    variant: {
      solid: { borderWidth: 0 },
      // A glass fill; the hairline ring is an inset shadow, not a stroke.
      outline: { backgroundColor: "$surfaceGlass", borderWidth: 0 },
      // The text button: no fill, at the touch floor.
      link: {
        backgroundColor: "transparent",
        borderWidth: 0,
        minHeight: "$target",
        paddingHorizontal: "$inline",
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
// The label's colour comes from `inkKey`, shared with the icon and spinner.

const ButtonTextFrame = styled(TamaguiText, {
  name: "ButtonText",
  context: ButtonContext,
  fontFamily: "$body",
  fontWeight: "600",
  ...(Platform.OS === PlatformType.ANDROID && {
    paddingEnd: "$inline",
    textBreakStrategy: "simple",
  }),

  variants: {
    action: {
      primary: {},
      secondary: {},
      positive: {},
      negative: {},
      default: {},
    },
    variant: {
      solid: {},
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
type ButtonTextProps = GetProps<typeof ButtonTextFrame>;

const ButtonText = React.forwardRef<React.ComponentRef<typeof ButtonTextFrame>, ButtonTextProps>(
  ({ fontSize, size, color, ...props }, ref) => {
    const ctx = ButtonContext.useStyledContext();
    const m = useTextScale();
    // The label's own size prop wins over the Button's size context.
    const sizeKey = typeof size === "string" ? size : ctx.size;
    return (
      <ButtonTextFrame
        ref={ref}
        {...props}
        color={color ?? `$${inkKey(ctx.action, ctx.variant)}`}
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

  const resolvedColor = colorProp ?? theme[inkKey(ctx.action, ctx.variant)].val;

  return <IconComponent size={resolveIconSize(iconSize)} color={resolvedColor} />;
};
ButtonIcon.displayName = "ButtonIcon";

// --- ButtonSpinner ---

const ButtonSpinner: React.FC<{ color?: string }> = ({ color }) => {
  const ctx = ButtonContext.useStyledContext();
  const theme = useTheme();

  const resolvedColor = color ?? theme[inkKey(ctx.action, ctx.variant)].val;

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

type ButtonFrameProps = GetProps<typeof ButtonFrame>;

const ButtonRoot = React.forwardRef<React.ComponentRef<typeof ButtonFrame>, ButtonFrameProps>(
  ({ hitSlop, accessibilityState, style, ...props }, ref) => {
    const shadow = useButtonShadow(props.action ?? "primary", props.variant ?? "solid");
    return (
      <ButtonFrame
        ref={ref}
        hitSlop={hitSlop ?? touchSlop(props.size ?? "md")}
        // The disabled variant only dims; the reader needs the state too.
        accessibilityState={{ ...accessibilityState, disabled: Boolean(props.disabled) }}
        {...props}
        style={shadow ? [{ boxShadow: shadow }, style] : style}
      />
    );
  }
);
ButtonRoot.displayName = "Button";

const Button = withStaticProperties(ButtonRoot, {
  Text: ButtonText,
  Icon: ButtonIcon,
  Spinner: ButtonSpinner,
  Group: ButtonGroup,
});

type ButtonProps = ButtonFrameProps;

export { Button, ButtonIcon, ButtonSpinner, ButtonGroup };
export type {
  ButtonProps,
  ButtonIconProps,
  ButtonGroupProps,
  ButtonSize,
  ButtonVariant,
  ButtonAction,
};
