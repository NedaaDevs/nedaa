import type { ComponentProps, ComponentRef, RefObject } from "react";
import { Platform, StyleSheet, type View as NativeView } from "react-native";
import { BlurView } from "expo-blur";
import { getTokenValue, View } from "tamagui";

import { HighlightEdge, type RadiusName, useElevationShadow } from "@/components/ui/material/edge";
import { chooseMaterialSurface, MATERIAL_SURFACE } from "@/components/ui/material/surface";
import { useIsDarkTheme, useThemeColor } from "@/components/ui/theme-color";
import { BLUR_INTENSITY, BLUR_REDUCTION, BLUR_TINT, type BlurLevel } from "@/constants/Blur";
import { ELEVATION_LEVEL, type ElevationLevel } from "@/constants/Elevation";
import { BRIGHTNESS } from "@/constants/Palette";
import { PlatformType } from "@/enums/app";
import { useReduceTransparency } from "@/hooks/useReduceTransparency";

/** The surfaces a material can draw; each pairs a theme colour with a blur. */
export const MATERIAL = {
  FLOAT: "float",
  SHEET_HEADER: "sheetHeader",
} as const;

export type MaterialName = (typeof MATERIAL)[keyof typeof MATERIAL];

/** Which corners a material rounds: a sheet header meets its body square. */
const CORNERS = { ALL: "all", TOP: "top" } as const;
type Corners = (typeof CORNERS)[keyof typeof CORNERS];

const MATERIAL_SPEC = {
  [MATERIAL.FLOAT]: { color: "$surfaceFloat", blur: "FLOAT", corners: CORNERS.ALL },
  [MATERIAL.SHEET_HEADER]: { color: "$surfaceFloat", blur: "SHEET", corners: CORNERS.TOP },
} as const satisfies Record<MaterialName, { color: string; blur: BlurLevel; corners: Corners }>;

const cornerRadii = (corners: Corners, radius: number) =>
  corners === CORNERS.TOP
    ? { borderTopStartRadius: radius, borderTopEndRadius: radius }
    : { borderRadius: radius };

const OPAQUE_ALPHA = "FF";

/** The colour with its alpha channel set to full. */
const opaque = (hex: string): string => `${hex.slice(0, 7)}${OPAQUE_ALPHA}`;

type MaterialProps = ComponentProps<typeof View> & {
  material: MaterialName;
  elevation?: ElevationLevel;
  radius?: RadiusName;
  /** Android only: the view whose pixels the blur reads. */
  blurTarget?: RefObject<ComponentRef<typeof NativeView> | null>;
};

/** A tinted, blurred surface with a lit top edge; opaque where blur is unavailable. */
export const Material = ({
  material,
  elevation = ELEVATION_LEVEL.E1,
  radius = "card",
  blurTarget,
  children,
  style,
  ...props
}: MaterialProps) => {
  const spec = MATERIAL_SPEC[material];
  const tint = useThemeColor(spec.color);
  const isDark = useIsDarkTheme();
  const reduceTransparency = useReduceTransparency();
  const surface = chooseMaterialSurface({
    platform: Platform.OS === PlatformType.ANDROID ? PlatformType.ANDROID : PlatformType.IOS,
    apiLevel: typeof Platform.Version === "number" ? Platform.Version : 0,
    reduceTransparency,
    hasBlurTarget: blurTarget != null,
  });
  const radii = cornerRadii(spec.corners, getTokenValue(`$${radius}`, "radius"));
  const shadow = useElevationShadow(elevation);

  return (
    <View
      {...props}
      style={[
        radii,
        { backgroundColor: surface === MATERIAL_SURFACE.BLUR ? tint : opaque(tint) },
        shadow == null ? undefined : { boxShadow: shadow },
        style,
      ]}>
      {surface === MATERIAL_SURFACE.BLUR && (
        <BlurView
          intensity={BLUR_INTENSITY[spec.blur]}
          tint={BLUR_TINT[isDark ? BRIGHTNESS.DARK : BRIGHTNESS.LIGHT]}
          blurReductionFactor={BLUR_REDUCTION}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget}
          style={[StyleSheet.absoluteFill, radii, { overflow: "hidden" }]}
        />
      )}
      <HighlightEdge owner={props.testID} radius={radius} />
      {children}
    </View>
  );
};
