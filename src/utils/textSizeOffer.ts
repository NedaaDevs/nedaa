import { PixelRatio } from "react-native";

import { OS_FONT_SCALE_OFFER_THRESHOLD } from "@/constants/TextSize";

/** True when the OS font scale is large enough to offer the in-app text size. */
export const isLargeOsTextActive = (): boolean =>
  PixelRatio.getFontScale() >= OS_FONT_SCALE_OFFER_THRESHOLD;
