import { useBrightness, useThemeColor } from "@/components/ui/theme-color";
import type { HorizonGlow } from "@/constants/AthkarHorizon";
import { BRIGHTNESS } from "@/constants/Palette";
import { hexAlpha } from "@/utils/hexAlpha";

/** The day sun's own colour; at night the look draws with the theme's. */
const SUNLIGHT = "#FFFFFF";

/** A glow round a disc, as a box shadow. */
export const glowShadow = (color: string, { blur, spread, alpha }: HorizonGlow) =>
  `0 0 ${blur}px ${spread}px ${hexAlpha(color, alpha)}`;

/** The Horizon look's colours: sunlight by day, the moon and its gold by night. */
export const useHorizonInk = () => {
  const brightness = useBrightness();
  const fg = useThemeColor("$fg");
  const accent = useThemeColor("$accent");
  const raised = useThemeColor("$raised");
  const night = brightness === BRIGHTNESS.DARK;
  return {
    brightness,
    fg,
    raised,
    /** The sun's disc. */
    disc: night ? fg : SUNLIGHT,
    /** The lit line, the points behind the sun, and every glow. */
    light: night ? accent : SUNLIGHT,
  };
};
