import { BRIGHTNESS, type Brightness } from "@/constants/Palette";
import { hexAlpha } from "@/utils/hexAlpha";

/** The sky wash at the top of a Focus ground: its height, and how much ground covers the sky's top. */
export const FOCUS_WASH = {
  HEIGHT: 220,
  TOP_COVER: { [BRIGHTNESS.LIGHT]: 0.5, [BRIGHTNESS.DARK]: 0.4 },
} as const satisfies { HEIGHT: number; TOP_COVER: Record<Brightness, number> };

/** The ground over a sky: thin at the top edge, whole from the wash's foot down. */
export const focusWashImage = (ground: string, brightness: Brightness): string => {
  const top = hexAlpha(ground, FOCUS_WASH.TOP_COVER[brightness]);
  return `linear-gradient(180deg, ${top} 0px, ${hexAlpha(ground, 1)} ${FOCUS_WASH.HEIGHT}px)`;
};
