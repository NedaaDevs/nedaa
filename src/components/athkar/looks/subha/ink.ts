import { useBrightness, useThemeColor } from "@/components/ui/theme-color";
import { SUBHA_BEAD_INK, SUBHA_BEAD_SHADOW } from "@/constants/AthkarSubha";
import { hexAlpha } from "@/utils/hexAlpha";
import { beadGradient } from "@/utils/subhaBeads";

/** The Subha look's colours: its ink, a bead at any size, its shadow. */
export const useSubhaInk = () => {
  const brightness = useBrightness();
  const fg = useThemeColor("$fg");
  const shadow = useThemeColor("$shadow");
  const surface = useThemeColor("$surface");
  const glass = useThemeColor("$surfaceGlass");
  const glassAlpha = glass.length > 7 ? parseInt(glass.slice(7, 9), 16) / 255 : 1;
  const { light, mid, edge } = SUBHA_BEAD_INK[brightness];
  const cast = SUBHA_BEAD_SHADOW[brightness];
  return {
    fg,
    surface,
    /** The glass's colour, its alpha scaled by `share`. */
    glass: (share: number) => hexAlpha(glass, glassAlpha * share),
    /** A bead's body at `size` points. */
    bead: (size: number) => beadGradient(size, { light: light.hex, mid: mid.hex, edge: edge.hex }),
    beadShadow: `0 ${cast.y}px ${cast.blur}px ${hexAlpha(shadow, cast.alpha)}`,
  };
};
