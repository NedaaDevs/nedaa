import React from "react";
import { Platform } from "react-native";
import {
  styled,
  View,
  Text as TamaguiText,
  createStyledContext,
  withStaticProperties,
} from "tamagui";
import { useThemeColor } from "@/components/ui/theme-color";
import type { GetProps } from "tamagui";
import { resolveIconSize, type IconSize } from "@/components/ui/icon";
import { PlatformType } from "@/enums/app";
import { useTextScale } from "@/hooks/useTextScale";

type FabSize = "sm" | "md" | "lg";
type FabPlacement =
  "top right" | "top left" | "bottom right" | "bottom left" | "top center" | "bottom center";

const FabContext = createStyledContext({
  size: "md" as FabSize,
});

const ICON_SIZE: Record<FabSize, IconSize> = {
  sm: "md",
  md: "lg",
  lg: "xl",
};

// --- FabFrame ---

const FabFrame = styled(View, {
  name: "Fab",
  context: FabContext,
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",
  position: "absolute",
  borderRadius: "$pill",
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
      sm: { width: "$10", height: "$10" },
      md: { width: "$12", height: "$12" },
      lg: { width: "$14", height: "$14" },
    },
    placement: {
      "top right": { top: "$group", right: "$group" },
      "top left": { top: "$group", left: "$group" },
      "bottom right": { bottom: "$group", right: "$group" },
      "bottom left": { bottom: "$group", left: "$group" },
      "top center": { top: "$group", alignSelf: "center" },
      "bottom center": { bottom: "$group", alignSelf: "center" },
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
  color = "$typographyContrast",
}) => {
  const ctx = FabContext.useStyledContext();
  const iconSize = sizeProp ?? ICON_SIZE[ctx.size ?? "md"];

  return <IconComponent size={resolveIconSize(iconSize)} color={useThemeColor(color)} />;
};
FabIcon.displayName = "FabIcon";

// --- FabLabel ---

const FabLabelFrame = styled(TamaguiText, {
  name: "FabLabel",
  context: FabContext,
  fontFamily: "$body",
  fontWeight: "600",
  color: "$typographyContrast",
  ...(Platform.OS === PlatformType.ANDROID && { paddingEnd: "$tight" }),

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
