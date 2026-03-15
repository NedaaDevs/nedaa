import { MushafVersion, QuranTheme } from "@/enums/quran";

export const TOTAL_PAGES = 604;
export const LINES_PER_PAGE = 15;
export const IMAGE_SOURCE_WIDTH = 1440;
export const IMAGE_SOURCE_LINE_HEIGHT = 232;

export const QURAN_THEME_COLORS: Record<
  QuranTheme,
  {
    background: string;
    textTint: string | undefined;
    markerColor: string;
    headerColor: string;
    pageNumberColor: string;
    highlightColor: string;
  }
> = {
  [QuranTheme.LIGHT]: {
    background: "#FFFDF7",
    textTint: undefined,
    markerColor: "#B8860B",
    headerColor: "#2C1810",
    pageNumberColor: "#8B7355",
    highlightColor: "rgba(255, 180, 100, 0.25)",
  },
  [QuranTheme.SEPIA]: {
    background: "#F8F1E3",
    textTint: "#5C3A1E",
    markerColor: "#8B6914",
    headerColor: "#5C3A1E",
    pageNumberColor: "#6D4C41",
    highlightColor: "rgba(180, 130, 60, 0.2)",
  },
  [QuranTheme.DARK]: {
    background: "#121212",
    textTint: "#B0B0B0",
    markerColor: "#C4A265",
    headerColor: "#B0B0B0",
    pageNumberColor: "#777777",
    highlightColor: "rgba(255, 255, 255, 0.12)",
  },
} as const;

export const MARKER_ADJUSTMENTS: Record<
  MushafVersion,
  { scaleMultiplier: number; offsetX: number; offsetY: number; fontSizeMultiplier: number }
> = {
  [MushafVersion.V1]: { scaleMultiplier: 1.0, offsetX: 0, offsetY: 0, fontSizeMultiplier: 0.85 },
  [MushafVersion.V2]: { scaleMultiplier: 1.0, offsetX: 0, offsetY: 0, fontSizeMultiplier: 0.85 },
  [MushafVersion.V4]: { scaleMultiplier: 1.0, offsetX: 0, offsetY: 0, fontSizeMultiplier: 0.85 },
} as const;

export const DEFAULT_MUSHAF_VERSION = MushafVersion.V1;
export const DEFAULT_QURAN_THEME = QuranTheme.LIGHT;
