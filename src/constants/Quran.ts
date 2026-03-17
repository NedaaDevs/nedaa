import { MushafVersion, QuranTheme } from "@/enums/quran";

export const TOTAL_PAGES = 604;
export const LINES_PER_PAGE = 15;
export const IMAGE_SOURCE_WIDTH = 1440;
export const IMAGE_SOURCE_LINE_HEIGHT = 232;

export const QURAN_THEME_COLORS: Record<
  QuranTheme,
  {
    background: string;
    innerBackground: string;
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
    innerBackground: "#FFFDF7",
    textTint: "#1C1C1E",
    markerColor: "#B8860B",
    headerColor: "#2C1810",
    pageNumberColor: "#8B7355",
    highlightColor: "rgba(255, 180, 100, 0.25)",
    shimmerBase: "#FFFDF7",
    shimmerHighlight: "#F0EDE6",
  },
  [QuranTheme.SEPIA]: {
    background: "#F8F1E3",
    innerBackground: "#F8F1E3",
    textTint: "#3E2C1A",
    markerColor: "#8B6914",
    headerColor: "#3E2C1A",
    pageNumberColor: "#6D4C41",
    highlightColor: "rgba(180, 130, 60, 0.2)",
    shimmerBase: "#F8F1E3",
    shimmerHighlight: "#EDE5D3",
  },
  [QuranTheme.DARK]: {
    background: "#121212",
    innerBackground: "#121212",
    textTint: "#D4CAB8",
    markerColor: "#C4A265",
    headerColor: "#D4CAB8",
    pageNumberColor: "#888888",
    highlightColor: "rgba(255, 255, 255, 0.12)",
    shimmerBase: "#1A1A1A",
    shimmerHighlight: "#2A2A2A",
  },
  [QuranTheme.CLASSIC]: {
    background: "#D8E8D0",
    innerBackground: "#F8F8F0",
    textTint: "#000000",
    markerColor: "#40A060",
    headerColor: "#000000",
    pageNumberColor: "#40A060",
    highlightColor: "rgba(240, 120, 184, 0.25)",
    shimmerBase: "#F8F8F0",
    shimmerHighlight: "#E8E8E0",
  },
  [QuranTheme.TINTED]: {
    background: "#F0E0D0",
    innerBackground: "#F8F8F0",
    textTint: "#885820",
    markerColor: "#D8C8B0",
    headerColor: "#885820",
    pageNumberColor: "#B89870",
    highlightColor: "rgba(184, 152, 112, 0.25)",
    shimmerBase: "#F8F8F0",
    shimmerHighlight: "#E8E0D0",
  },
  [QuranTheme.TINTED_DARK]: {
    background: "#181818",
    innerBackground: "#282830",
    textTint: "#707080",
    markerColor: "#303038",
    headerColor: "#707080",
    pageNumberColor: "#505060",
    highlightColor: "rgba(112, 112, 128, 0.15)",
    shimmerBase: "#282830",
    shimmerHighlight: "#383840",
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
