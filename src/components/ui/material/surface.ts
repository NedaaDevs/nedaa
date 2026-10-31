import { PlatformType, type PlatformTypeValue } from "@/enums/app";

/** Android 12, the first release whose blur is cheap enough to draw live. */
export const BLUR_MIN_ANDROID_API = 31;

export const MATERIAL_SURFACE = {
  BLUR: "blur",
  OPAQUE: "opaque",
} as const;

export type MaterialSurface = (typeof MATERIAL_SURFACE)[keyof typeof MATERIAL_SURFACE];

type SurfaceInput = {
  platform: PlatformTypeValue;
  apiLevel: number;
  reduceTransparency: boolean;
  /** Android blurs only a view it is handed; without one it draws no blur. */
  hasBlurTarget: boolean;
};

export const chooseMaterialSurface = ({
  platform,
  apiLevel,
  reduceTransparency,
  hasBlurTarget,
}: SurfaceInput): MaterialSurface => {
  if (reduceTransparency) return MATERIAL_SURFACE.OPAQUE;
  if (platform === PlatformType.ANDROID && (apiLevel < BLUR_MIN_ANDROID_API || !hasBlurTarget)) {
    return MATERIAL_SURFACE.OPAQUE;
  }
  return MATERIAL_SURFACE.BLUR;
};
