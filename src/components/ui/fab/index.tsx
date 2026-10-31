import React from "react";
import { Platform, StyleSheet } from "react-native";
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
import { Material, MATERIAL } from "@/components/ui/material";
import { usePressScale } from "@/components/ui/pressable/pressScale";
import { PlatformType } from "@/enums/app";
import { useTextScale } from "@/hooks/useTextScale";

/** Test ids for the parts a test reaches. */
export const FAB_PART = { SURFACE: "fab-surface" } as const;

/** The frame's box per size; its keys are the sizes a Fab takes. */
const FAB_FRAME_SIZE = {
  sm: { width: "$10", height: "$10" },
  md: { width: "$12", height: "$12" },
  lg: { width: "$14", height: "$14" },
} as const;

type FabSize = keyof typeof FAB_FRAME_SIZE;

const FabContext = createStyledContext<{ size: FabSize }>({ size: "md" });

const ICON_SIZE: Record<FabSize, IconSize> = {
  sm: "md",
  md: "lg",
  lg: "xl",
};

// --- FabFrame ---

const FabFrame = styled(View, {
  name: "Fab",
  context: FabContext,
  role: "button",
  // A View carrying a role is not yet an accessibility element.
  accessible: true,
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",
  position: "absolute",
  borderRadius: "$pill",
  // Bottom, at the cross-axis end of a column parent: right in English, left
  // in Arabic.
  bottom: "$group",
  alignSelf: "flex-end",
  marginEnd: "$group",

  variants: {
    size: FAB_FRAME_SIZE,
  } as const,

  defaultVariants: {
    size: "md",
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
  color = "$accent",
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
  color: "$fg",
  ...(Platform.OS === PlatformType.ANDROID && { paddingEnd: "$tight" }),

  // Sizes carry no styles: FabLabel computes the fontSize from the size
  // context so the app text-scale can multiply it.
  variants: {
    size: {
      sm: {},
      md: {},
      lg: {},
    } satisfies Record<FabSize, object>,
  } as const,
});

// Label font size per Fab size variant; the app text-scale multiplies it.
const FAB_FONT_SIZE: Record<FabSize, number> = { sm: 10, md: 12, lg: 14 };

type FabLabelWrapperProps = GetProps<typeof FabLabelFrame>;

const FabLabel = React.forwardRef<React.ComponentRef<typeof FabLabelFrame>, FabLabelWrapperProps>(
  ({ fontSize, ...props }, ref) => {
    const ctx = FabContext.useStyledContext();
    const m = useTextScale();
    const base = typeof fontSize === "number" ? fontSize : FAB_FONT_SIZE[ctx.size ?? "md"];
    return <FabLabelFrame ref={ref} {...props} fontSize={base * m} allowFontScaling={false} />;
  }
);
FabLabel.displayName = "FabLabel";

// --- Compound export ---

type FabProps = GetProps<typeof FabFrame>;

/** A round control on the float material; it shrinks under the finger. */
const FabRoot = ({ children, ...props }: FabProps) => {
  const pressScale = usePressScale();
  return (
    <FabFrame {...pressScale} {...props}>
      {/* No blur target, so Android draws the float colour opaque. */}
      <Material
        testID={FAB_PART.SURFACE}
        material={MATERIAL.FLOAT}
        radius="$pill"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </FabFrame>
  );
};

const Fab = withStaticProperties(FabRoot, {
  Icon: FabIcon,
  Label: FabLabel,
});

type FabLabelProps = FabLabelWrapperProps;

export { Fab, FabIcon, FabLabel };
export type { FabProps, FabIconProps, FabLabelProps, FabSize };
