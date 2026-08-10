import React from "react";
import { Platform } from "react-native";
import {
  styled,
  View,
  Text as TamaguiText,
  createStyledContext,
  withStaticProperties,
  useTheme,
} from "tamagui";
import type { GetProps } from "tamagui";
import { PlatformType } from "@/enums/app";
import { useTextScale } from "@/hooks/useTextScale";

type FabSize = "sm" | "md" | "lg";
type FabPlacement =
  "top right" | "top left" | "bottom right" | "bottom left" | "top center" | "bottom center";

const FabContext = createStyledContext({
  size: "md" as FabSize,
});

const ICON_SIZE: Record<FabSize, number> = {
  sm: 18,
  md: 20,
  lg: 24,
};

// --- FabFrame ---

const FabFrame = styled(View, {
  name: "Fab",
  context: FabContext,
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",
  position: "absolute",
  borderRadius: 999,
  backgroundColor: "$primary",
  shadowColor: "$typography",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  pressStyle: {
    opacity: 0.8,
  },

  variants: {
    size: {
      sm: { width: 40, height: 40 },
      md: { width: 48, height: 48 },
      lg: { width: 56, height: 56 },
    },
    placement: {
      "top right": { top: 16, right: 16 },
      "top left": { top: 16, left: 16 },
      "bottom right": { bottom: 16, right: 16 },
      "bottom left": { bottom: 16, left: 16 },
      "top center": { top: 16, alignSelf: "center" },
      "bottom center": { bottom: 16, alignSelf: "center" },
    },
  } as const,

  defaultVariants: {
    size: "md",
    placement: "bottom right",
  },
});

// --- FabIcon ---

type FabIconProps = {
  as: React.ComponentType<{ size?: number; color?: string }>;
  size?: number;
  color?: string;
};

const FabIcon: React.FC<FabIconProps> = ({
  as: IconComponent,
  size: sizeProp,
  color: colorProp,
}) => {
  const ctx = FabContext.useStyledContext();
  const theme = useTheme();

  const iconSize = sizeProp ?? ICON_SIZE[ctx.size ?? "md"];
  const resolvedColor = colorProp
    ? colorProp.startsWith("$")
      ? ((theme as Record<string, { val: string }>)[colorProp.slice(1)]?.val ?? colorProp)
      : colorProp
    : theme.typographyContrast.val;

  return <IconComponent size={iconSize} color={resolvedColor} />;
};
FabIcon.displayName = "FabIcon";

// --- FabLabel ---

const FabLabelFrame = styled(TamaguiText, {
  name: "FabLabel",
  context: FabContext,
  fontFamily: "$body",
  fontWeight: "600",
  color: "$typographyContrast",
  ...(Platform.OS === PlatformType.ANDROID && { paddingEnd: 4 }),

  // Sizes carry no styles: FabLabel computes the fontSize from the size
  // context so the app text-scale can multiply it.
  variants: {
    size: {
      sm: {},
      md: {},
      lg: {},
    },
  } as const,
});

// Label font size per Fab size variant; the app text-scale multiplies it.
const FAB_FONT_SIZE: Record<string, number> = { sm: 10, md: 12, lg: 14 };

type FabLabelWrapperProps = GetProps<typeof FabLabelFrame> & { scaleOverride?: number };

const FabLabel = React.forwardRef<React.ComponentRef<typeof FabLabelFrame>, FabLabelWrapperProps>(
  ({ fontSize, scaleOverride, ...props }, ref) => {
    const ctx = FabContext.useStyledContext();
    const appScale = useTextScale();
    const m = scaleOverride ?? appScale;
    const base = typeof fontSize === "number" ? fontSize : (FAB_FONT_SIZE[ctx.size ?? "md"] ?? 12);
    return <FabLabelFrame ref={ref} {...props} fontSize={base * m} allowFontScaling={false} />;
  }
);
FabLabel.displayName = "FabLabel";

// --- Compound export ---

const Fab = withStaticProperties(FabFrame, {
  Icon: FabIcon,
  Label: FabLabel,
});

type FabProps = GetProps<typeof FabFrame>;
type FabLabelProps = FabLabelWrapperProps;

export { Fab, FabIcon, FabLabel };
export type { FabProps, FabIconProps, FabLabelProps, FabSize, FabPlacement };
