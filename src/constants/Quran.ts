import { MushafVersion, QuranTheme, SurahFrameStyle } from "@/enums/quran";

export const TOTAL_PAGES = 604;
export const LINES_PER_PAGE = 15;
export const IMAGE_SOURCE_WIDTH = 1440;
export const IMAGE_SOURCE_LINE_HEIGHT = 232;

export const FONT_SIZE_MIN = 20;
export const FONT_SIZE_MAX = 48;
export const FONT_SIZE_DEFAULT = 28;
export const FONT_SIZE_STEP = 2;

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
  [QuranTheme.SEPIA]: {
    background: "#F3F0E9",
    innerBackground: "#F3F0E9",
    textTint: "#2C1810",
    markerColor: "#7A5C12",
    headerColor: "#4A3520",
    pageNumberColor: "#8B7355",
    highlightColor: "rgba(170, 130, 50, 0.18)",
    shimmerBase: "#F3F0E9",
    shimmerHighlight: "#EAE6DC",
  },
  [QuranTheme.DARK]: {
    background: "#0E0E0E",
    innerBackground: "#0E0E0E",
    textTint: "#E8E0D4",
    markerColor: "#D4A84B",
    headerColor: "#E8E0D4",
    pageNumberColor: "#6B6B6B",
    highlightColor: "rgba(212, 168, 75, 0.15)",
    shimmerBase: "#181818",
    shimmerHighlight: "#282828",
  },
} as const;

export const MARKER_ADJUSTMENTS: Record<
  MushafVersion,
  { scaleMultiplier: number; offsetX: number; offsetY: number; fontSizeMultiplier: number }
> = {
  [MushafVersion.V1]: { scaleMultiplier: 1.0, offsetX: 0, offsetY: 0, fontSizeMultiplier: 0.45 },
  [MushafVersion.V2]: { scaleMultiplier: 1.0, offsetX: 0, offsetY: 0, fontSizeMultiplier: 0.45 },
  [MushafVersion.V4]: { scaleMultiplier: 1.0, offsetX: 0, offsetY: 0, fontSizeMultiplier: 0.45 },
} as const;

export const QURAN_MARKER_FRAME: Record<QuranTheme, string> = {
  [QuranTheme.SEPIA]: "marker-sepia.png",
  [QuranTheme.DARK]: "marker-dark.png",
};

export const DEFAULT_SURAH_FRAME_STYLE = SurahFrameStyle.CLASSIC;

export const DEFAULT_MUSHAF_VERSION = MushafVersion.V1;
export const DEFAULT_QURAN_THEME = QuranTheme.SEPIA;

// Versions whose page images are full-colour (e.g. tajweed-coloured). Their
// PNGs must NOT be tinted — a tintColor flattens every pixel to one colour.
export const COLORED_MUSHAF_VERSIONS = new Set<MushafVersion>([MushafVersion.V4]);

export const isColoredVersion = (version: MushafVersion): boolean =>
  COLORED_MUSHAF_VERSIONS.has(version);

// Path segment for a version's images. Colored versions in dark theme read
// from the separate dark bundle when it's downloaded; everything else (and the
// fallback when dark isn't downloaded) reads the main directory.
export const quranImageDirSegment = (
  version: MushafVersion,
  quranTheme: QuranTheme,
  darkAvailable: boolean
): string =>
  quranTheme === QuranTheme.DARK && isColoredVersion(version) && darkAvailable
    ? `${version}-dark`
    : `${version}`;

export const QURAN_UI_COLORS = {
  accent: "#B8860B",
  accentWarning: "#D4A017",
  background: "#FFFDF7",
  cardBackground: "#FFFFFF",
  cardBorder: "#E8E0D0",
  subtleText: "#8B7355",
  progressTrack: "#E8E0D0",
} as const;

export const QURAN_FONT_FAMILY = "UthmanicHafs";

export const toHafsDigits = (n: number): string =>
  String(n)
    .split("")
    .reverse()
    .map((d) => String.fromCharCode(0xfd50 + +d))
    .join("");

export const SURAH_NAMES: readonly string[] = [
  "",
  "الفاتحة",
  "البقرة",
  "آل عمران",
  "النساء",
  "المائدة",
  "الأنعام",
  "الأعراف",
  "الأنفال",
  "التوبة",
  "يونس",
  "هود",
  "يوسف",
  "الرعد",
  "إبراهيم",
  "الحجر",
  "النحل",
  "الإسراء",
  "الكهف",
  "مريم",
  "طه",
  "الأنبياء",
  "الحج",
  "المؤمنون",
  "النور",
  "الفرقان",
  "الشعراء",
  "النمل",
  "القصص",
  "العنكبوت",
  "الروم",
  "لقمان",
  "السجدة",
  "الأحزاب",
  "سبأ",
  "فاطر",
  "يس",
  "الصافات",
  "ص",
  "الزمر",
  "غافر",
  "فصلت",
  "الشورى",
  "الزخرف",
  "الدخان",
  "الجاثية",
  "الأحقاف",
  "محمد",
  "الفتح",
  "الحجرات",
  "ق",
  "الذاريات",
  "الطور",
  "النجم",
  "القمر",
  "الرحمن",
  "الواقعة",
  "الحديد",
  "المجادلة",
  "الحشر",
  "الممتحنة",
  "الصف",
  "الجمعة",
  "المنافقون",
  "التغابن",
  "الطلاق",
  "التحريم",
  "الملك",
  "القلم",
  "الحاقة",
  "المعارج",
  "نوح",
  "الجن",
  "المزمل",
  "المدثر",
  "القيامة",
  "الإنسان",
  "المرسلات",
  "النبأ",
  "النازعات",
  "عبس",
  "التكوير",
  "الانفطار",
  "المطففين",
  "الانشقاق",
  "البروج",
  "الطارق",
  "الأعلى",
  "الغاشية",
  "الفجر",
  "البلد",
  "الشمس",
  "الليل",
  "الضحى",
  "الشرح",
  "التين",
  "العلق",
  "القدر",
  "البينة",
  "الزلزلة",
  "العاديات",
  "القارعة",
  "التكاثر",
  "العصر",
  "الهمزة",
  "الفيل",
  "قريش",
  "الماعون",
  "الكوثر",
  "الكافرون",
  "النصر",
  "المسد",
  "الإخلاص",
  "الفلق",
  "الناس",
] as const;

export const DOWNLOAD_CONCURRENCY = 6;
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAYS_MS = [1000, 3000, 10000];
export const MIN_PAGES_BEFORE_READING = 5;
