import type { ComponentProps, RefObject } from "react";
import { Platform, StyleSheet, type ViewInstance } from "react-native";
import { BlurView } from "expo-blur";
import { getTokenValue, View, type RadiusTokens } from "tamagui";

import { HighlightEdge, useElevationShadow } from "@/components/ui/material/edge";
import { chooseMaterialSurface, MATERIAL_SURFACE } from "@/components/ui/material/surface";
import { useBrightness, useThemeColor } from "@/components/ui/theme-color";
import { BLUR_INTENSITY, BLUR_REDUCTION, BLUR_TINT, type BlurLevel } from "@/constants/Blur";
import { ELEVATION_LEVEL, type ElevationLevel } from "@/constants/Elevation";
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

type MaterialSpec = {
  color: string;
  blur: BlurLevel;
  corners: Corners;
  elevation: ElevationLevel;
};

const MATERIAL_SPEC = {
  [MATERIAL.FLOAT]: {
    color: "$surfaceFloat",
    blur: "FLOAT",
    corners: CORNERS.ALL,
    elevation: ELEVATION_LEVEL.E2,
  },
  [MATERIAL.SHEET_HEADER]: {
    color: "$surfaceFloat",
    blur: "SHEET",
    corners: CORNERS.TOP,
    elevation: ELEVATION_LEVEL.E0,
  },
} as const satisfies Record<MaterialName, MaterialSpec>;

const cornerRadii = (corners: Corners, radius: number) =>
  corners === CORNERS.TOP
    ? { borderTopStartRadius: radius, borderTopEndRadius: radius }
    : { borderRadius: radius };

/** A radius token or points; the native blur view takes it in points. */
type MaterialRadius = Extract<RadiusTokens, `$${string}`> | number;

const OPAQUE_ALPHA = "FF";

/** The colour with its alpha channel set to full. */
const opaque = (hex: string): string => `${hex.slice(0, 7)}${OPAQUE_ALPHA}`;

type MaterialProps = ComponentProps<typeof View> & {
  material: MaterialName;
  radius?: MaterialRadius;
  /** Android only: the view whose pixels the blur reads. */
  blurTarget?: RefObject<ViewInstance | null>;
  /** Draws a hairline just inside the edge, for a surface over a bright sky. */
  ring?: boolean;
};

/** The hairline ring's width, under a point so it reads as an edge. */
const RING_WIDTH = 0.5;

/** A tinted, blurred surface with a lit top edge; opaque where blur is unavailable. */
export const Material = ({
  material,
  radius = "$card",
  blurTarget,
  ring = false,
  children,
  style,
  ...props
}: MaterialProps) => {
  const spec = MATERIAL_SPEC[material];
  const tint = useThemeColor(spec.color);
  const hairline = useThemeColor("$hairline");
  const brightness = useBrightness();
  const reduceTransparency = useReduceTransparency();
  const surface = chooseMaterialSurface({
    platform: Platform.OS === PlatformType.ANDROID ? PlatformType.ANDROID : PlatformType.IOS,
    apiLevel: typeof Platform.Version === "number" ? Platform.Version : 0,
    reduceTransparency,
    hasBlurTarget: blurTarget != null,
  });
  const corner = typeof radius === "number" ? radius : getTokenValue(radius, "radius");
  const radii = cornerRadii(spec.corners, corner);
  const lift = useElevationShadow(spec.elevation);
  const inner = ring ? `inset 0 0 0 ${RING_WIDTH}px ${hairline}` : undefined;
  const shadow = [lift, inner].filter(Boolean).join(", ") || undefined;

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
          tint={BLUR_TINT[brightness]}
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
