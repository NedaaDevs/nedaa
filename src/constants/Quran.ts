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
    shimmerBase: string;
    shimmerHighlight: string;
  }
> = {
  [QuranTheme.LIGHT]: {
    background: "#FFFDF7",
    textTint: undefined,
    markerColor: "#B8860B",
    headerColor: "#2C1810",
    pageNumberColor: "#8B7355",
    highlightColor: "rgba(255, 180, 100, 0.25)",
    shimmerBase: "#FFFDF7",
    shimmerHighlight: "#F0EDE6",
  },
  [QuranTheme.SEPIA]: {
    background: "#F8F1E3",
    textTint: "#5C3A1E",
    markerColor: "#8B6914",
    headerColor: "#5C3A1E",
    pageNumberColor: "#6D4C41",
    highlightColor: "rgba(180, 130, 60, 0.2)",
    shimmerBase: "#F8F1E3",
    shimmerHighlight: "#EDE5D3",
  },
  [QuranTheme.DARK]: {
    background: "#121212",
    textTint: "#E0D6C8",
    markerColor: "#C4A265",
    headerColor: "#E0D6C8",
    pageNumberColor: "#888888",
    highlightColor: "rgba(255, 255, 255, 0.12)",
    shimmerBase: "#1A1A1A",
    shimmerHighlight: "#2A2A2A",
  },
  [QuranTheme.CLASSIC]: {
    background: "#D8E8D0",
    textTint: undefined,
    markerColor: "#40A060",
    headerColor: "#000000",
    pageNumberColor: "#40A060",
    highlightColor: "rgba(240, 120, 184, 0.2)",
    shimmerBase: "#D8E8D0",
    shimmerHighlight: "#C8D8C0",
  },
  [QuranTheme.TINTED]: {
    background: "#F0E0D0",
    textTint: "#885820",
    markerColor: "#B89870",
    headerColor: "#885820",
    pageNumberColor: "#B89870",
    highlightColor: "rgba(184, 152, 112, 0.2)",
    shimmerBase: "#F0E0D0",
    shimmerHighlight: "#E0D0C0",
  },
  [QuranTheme.TINTED_DARK]: {
    background: "#181818",
    textTint: "#707080",
    markerColor: "#303038",
    headerColor: "#707080",
    pageNumberColor: "#505060",
    highlightColor: "rgba(112, 112, 128, 0.15)",
    shimmerBase: "#181818",
    shimmerHighlight: "#282830",
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

export const RECOMMENDED_VERSION = MushafVersion.V2;

export const QURAN_UI_COLORS = {
  accent: "#B8860B",
  accentWarning: "#D4A017",
  background: "#FFFDF7",
  cardBackground: "#FFFFFF",
  cardBorder: "#E8E0D0",
  subtleText: "#8B7355",
  progressTrack: "#E8E0D0",
} as const;

export const DOWNLOAD_CONCURRENCY = 6;
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAYS_MS = [1000, 3000, 10000];
export const MIN_PAGES_BEFORE_READING = 5;
