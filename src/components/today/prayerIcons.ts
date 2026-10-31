import {
  MoonStar,
  Sun,
  SunDim,
  SunMedium,
  Sunrise,
  Sunset,
  type LucideIcon,
} from "lucide-react-native";

import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import type { RhythmTimingId } from "@/utils/rhythm";

/** Each timing's glyph, the same on the day's line and on its card. */
export const PRAYER_ICONS: Record<RhythmTimingId, LucideIcon> = {
  [PRAYER_ID.FAJR]: Sunrise,
  [OTHER_TIMING.SUNRISE]: Sun,
  [PRAYER_ID.DHUHR]: SunMedium,
  [PRAYER_ID.ASR]: SunDim,
  [PRAYER_ID.MAGHRIB]: Sunset,
  [PRAYER_ID.ISHA]: MoonStar,
};
