import {
  AutoScrollSpeed,
  BookmarkColor,
  HighlightColor,
  MushafVersion,
  QuranTheme,
  QuranThemeType,
} from "@/enums/quran";

export const TOTAL_PAGES = 604;
export const LINES_PER_PAGE = 15;
export const IMAGE_SOURCE_WIDTH = 1440;
export const IMAGE_SOURCE_LINE_HEIGHT = 232;

export const FONT_SIZE_MIN = 20;
export const FONT_SIZE_MAX = 48;
export const FONT_SIZE_DEFAULT = 28;
export const FONT_SIZE_STEP = 2;

// Auto-scroll pace is a continuous points/second value (device-independent). The
// three presets are anchor values the `−`/`+` buttons then fine-tune between.
export const AUTO_SCROLL_SPEED_PX: Record<AutoScrollSpeed, number> = {
  [AutoScrollSpeed.SLOW]: 18,
  [AutoScrollSpeed.MEDIUM]: 34,
  [AutoScrollSpeed.FAST]: 60,
};
export const AUTO_SCROLL_SPEED_MIN = 8;
export const AUTO_SCROLL_SPEED_MAX = 100;
export const AUTO_SCROLL_SPEED_STEP = 4;
export const DEFAULT_AUTO_SCROLL_SPEED = AUTO_SCROLL_SPEED_PX[AutoScrollSpeed.MEDIUM];

// Clamp any speed (fine step, preset, or migrated value) into the valid range.
export const clampAutoScrollSpeed = (px: number): number =>
  Math.max(AUTO_SCROLL_SPEED_MIN, Math.min(AUTO_SCROLL_SPEED_MAX, Math.round(px)));

export const QURAN_THEME_COLORS: Record<
  QuranThemeType,
  {
    // Hex colors are typed `#${string}` so they satisfy Tamagui color props
    // directly (Tamagui rejects bare `string`); they remain assignable to the RN
    // consumers (Image tintColor, icons) too. textTint stays nullable for Image,
    // and highlightColor is an rgba overlay string.
    background: `#${string}`;
    innerBackground: `#${string}`;
    textTint: `#${string}` | undefined;
    markerColor: `#${string}`;
    // Lighter ornamental gold for the Mihrab frame / cartouche / rosette ink,
    // distinct from the heavier markerColor baked into the page images.
    frameColor: `#${string}`;
    headerColor: `#${string}`;
    pageNumberColor: `#${string}`;
    highlightColor: string;
    shimmerBase: `#${string}`;
    shimmerHighlight: `#${string}`;
    // BookCanvas ambient ground (large devices): radial gradient from
    // canvasInner (center, near the page) to canvasOuter (screen edges).
    canvasInner: `#${string}`;
    canvasOuter: `#${string}`;
  }
> = {
  [QuranTheme.SEPIA]: {
    background: "#F3F0E9",
    innerBackground: "#F3F0E9",
    textTint: "#2C1810",
    markerColor: "#7A5C12",
    frameColor: "#B1933F",
    headerColor: "#4A3520",
    pageNumberColor: "#8B7355",
    highlightColor: "rgba(170, 130, 50, 0.18)",
    shimmerBase: "#F3F0E9",
    shimmerHighlight: "#EAE6DC",
    canvasInner: "#F6F2E7",
    canvasOuter: "#E6DECA",
  },
  [QuranTheme.DARK]: {
    background: "#19191B",
    innerBackground: "#19191B",
    textTint: "#E4E6EA",
    markerColor: "#D4A84B",
    frameColor: "#8A7438",
    headerColor: "#E4E6EA",
    pageNumberColor: "#6B6B6B",
    highlightColor: "rgba(212, 168, 75, 0.15)",
    shimmerBase: "#181818",
    shimmerHighlight: "#282828",
    canvasInner: "#1C1C1F",
    canvasOuter: "#111113",
  },
  // Crisp neutral white paper with near-black ink.
  [QuranTheme.LIGHT]: {
    background: "#FFFFFF",
    innerBackground: "#FFFFFF",
    textTint: "#1A1A1A",
    markerColor: "#7A5C12",
    frameColor: "#9A8030",
    headerColor: "#2A2A2A",
    pageNumberColor: "#9A9A9A",
    highlightColor: "rgba(170, 130, 50, 0.15)",
    shimmerBase: "#FFFFFF",
    shimmerHighlight: "#F0F0F0",
    canvasInner: "#FFFFFF",
    canvasOuter: "#EFEEEA",
  },
  // Nedaa brand paper, light — the app's cool surface with blue accents.
  [QuranTheme.NEDAA_LIGHT]: {
    background: "#F5F7FA",
    innerBackground: "#F5F7FA",
    textTint: "#1C1C1C",
    markerColor: "#1C5D7D",
    frameColor: "#1C5D7D",
    headerColor: "#1C5D85",
    pageNumberColor: "#6B7A85",
    highlightColor: "rgba(28, 93, 125, 0.15)",
    shimmerBase: "#F5F7FA",
    shimmerHighlight: "#E8EDF2",
    canvasInner: "#F7F9FC",
    canvasOuter: "#E7ECF2",
  },
  // Nedaa brand paper, dark — deep slate ground, cool dimmed-white ink, gold accents.
  [QuranTheme.NEDAA_DARK]: {
    background: "#14171C",
    innerBackground: "#14171C",
    textTint: "#DEDFE1",
    markerColor: "#E6C469",
    frameColor: "#C9A84B",
    headerColor: "#E6C469",
    pageNumberColor: "#A0936A",
    highlightColor: "rgba(230, 196, 105, 0.15)",
    shimmerBase: "#16191F",
    shimmerHighlight: "#23272F",
    canvasInner: "#171B21",
    canvasOuter: "#0E1114",
  },
} as const;

export const MARKER_ADJUSTMENTS: Record<
  MushafVersion,
  { scaleMultiplier: number; offsetX: number; offsetY: number; fontSizeMultiplier: number }
> = {
  [MushafVersion.V1]: { scaleMultiplier: 1.1, offsetX: 0, offsetY: 0, fontSizeMultiplier: 0.5 },
  [MushafVersion.V2]: { scaleMultiplier: 1.1, offsetX: 0, offsetY: 0, fontSizeMultiplier: 0.5 },
  [MushafVersion.V4]: { scaleMultiplier: 1.1, offsetX: 0, offsetY: 0, fontSizeMultiplier: 0.5 },
} as const;

export const QURAN_MARKER_FRAME: Record<QuranThemeType, string> = {
  [QuranTheme.SEPIA]: "marker-sepia.png",
  [QuranTheme.DARK]: "marker-dark.png",
  [QuranTheme.NEDAA_DARK]: "marker-dark.png",
  // Light papers (light, nedaa-light) reuse the sepia (dark-ink) frame.
  [QuranTheme.LIGHT]: "marker-sepia.png",
  [QuranTheme.NEDAA_LIGHT]: "marker-sepia.png",
};

export const DEFAULT_MUSHAF_VERSION = MushafVersion.V1;
export const DEFAULT_QURAN_THEME = QuranTheme.NEDAA_LIGHT;

// Versions whose page images are full-colour (e.g. tajweed-coloured). Their
// PNGs must NOT be tinted — a tintColor flattens every pixel to one colour.
export const COLORED_MUSHAF_VERSIONS = new Set<MushafVersion>([MushafVersion.V4]);

export const isColoredVersion = (version: MushafVersion): boolean =>
  COLORED_MUSHAF_VERSIONS.has(version);

// A dark paper background (DARK or NEDAA_DARK) where coloured pages would be
// unreadable, so colored editions read their dark bundle on those themes.
export const isDarkPaper = (quranTheme: QuranThemeType): boolean =>
  quranTheme === QuranTheme.DARK || quranTheme === QuranTheme.NEDAA_DARK;

// solid = dot/ribbon ink; tint = highlight overlay, lightened for dark paper.
export const HIGHLIGHT_COLORS: Record<
  HighlightColor,
  { solid: `#${string}`; tintLight: string; tintDark: string }
> = {
  [HighlightColor.RED]: {
    solid: "#C0453E",
    tintLight: "rgba(192,69,62,0.20)",
    tintDark: "rgba(240,120,112,0.26)",
  },
  [HighlightColor.ORANGE]: {
    solid: "#D2772F",
    tintLight: "rgba(210,119,47,0.20)",
    tintDark: "rgba(250,160,90,0.26)",
  },
  [HighlightColor.AMBER]: {
    solid: "#C99A24",
    tintLight: "rgba(201,154,36,0.22)",
    tintDark: "rgba(240,200,80,0.26)",
  },
  [HighlightColor.GREEN]: {
    solid: "#3E9A59",
    tintLight: "rgba(62,154,89,0.20)",
    tintDark: "rgba(110,210,140,0.24)",
  },
  [HighlightColor.TEAL]: {
    solid: "#2E9AA0",
    tintLight: "rgba(46,154,160,0.20)",
    tintDark: "rgba(90,205,210,0.24)",
  },
  [HighlightColor.BLUE]: {
    solid: "#3B79C9",
    tintLight: "rgba(59,121,201,0.20)",
    tintDark: "rgba(110,170,255,0.26)",
  },
  [HighlightColor.PURPLE]: {
    solid: "#8C53B8",
    tintLight: "rgba(140,83,184,0.20)",
    tintDark: "rgba(200,140,245,0.26)",
  },
} as const;

export const HIGHLIGHT_COLOR_ORDER = Object.values(HighlightColor);

export const highlightTint = (color: HighlightColor, quranTheme: QuranThemeType): string =>
  isDarkPaper(quranTheme) ? HIGHLIGHT_COLORS[color].tintDark : HIGHLIGHT_COLORS[color].tintLight;

// Bookmark ribbon colours — solid jewel tones, kept off the highlight hues so the
// edge ribbon never reads as a highlight wash. `solid` fills the ribbon glyph;
// the tints back the confirm card, lightened for dark paper so it stays visible.
export const BOOKMARK_COLORS: Record<
  BookmarkColor,
  { solid: `#${string}`; tintLight: string; tintDark: string }
> = {
  [BookmarkColor.GARNET]: {
    solid: "#9E3B4E",
    tintLight: "rgba(158,59,78,0.16)",
    tintDark: "rgba(200,100,120,0.24)",
  },
  [BookmarkColor.BRASS]: {
    solid: "#9A7327",
    tintLight: "rgba(154,115,39,0.18)",
    tintDark: "rgba(205,165,85,0.24)",
  },
  [BookmarkColor.PINE]: {
    solid: "#2F6B57",
    tintLight: "rgba(47,107,87,0.16)",
    tintDark: "rgba(95,175,145,0.24)",
  },
  [BookmarkColor.INDIGO]: {
    solid: "#3C4E8C",
    tintLight: "rgba(60,78,140,0.16)",
    tintDark: "rgba(120,140,215,0.24)",
  },
} as const;

export const BOOKMARK_COLOR_ORDER = Object.values(BookmarkColor);

export const bookmarkTint = (color: BookmarkColor, quranTheme: QuranThemeType): string =>
  isDarkPaper(quranTheme) ? BOOKMARK_COLORS[color].tintDark : BOOKMARK_COLORS[color].tintLight;

// Path segment for a version's images. A colored edition on a dark paper reads
// the separate dark bundle when downloaded; everything else (and the fallback
// when the dark bundle isn't downloaded) reads the main directory.
export const quranImageDirSegment = (
  version: MushafVersion,
  quranTheme: QuranThemeType,
  darkAvailable: boolean
): string =>
  isDarkPaper(quranTheme) && isColoredVersion(version) && darkAvailable
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

// Ornamental ayah/page-number font (FD50 digit glyphs).
export const QURAN_FONT_FAMILY = "UthmanicHafs";

// Text-reader body font: the flowing KFGQPC Hafs build — authentic Uthmani
// letterforms with small combining marks.
export const QURAN_TEXT_FONT = "Hafs";

// Ornamental ayah/page digits (FD50 glyphs in UthmanicHafs). These are symbol
// glyphs, so the source string is pre-reversed to lay out right-to-left.
export const toHafsDigits = (n: number): string =>
  String(n)
    .split("")
    .reverse()
    .map((d) => String.fromCharCode(0xfd50 + +d))
    .join("");

// Standard Arabic-Indic digits (U+0660–9). These are bidi numbers, so they lay
// out correctly without reversing — used for in-flow ayah markers.
export const toArabicDigits = (n: number): string =>
  String(n)
    .split("")
    .map((d) => String.fromCharCode(0x0660 + +d))
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

// Transliterated surah names (for Latin-script app locales: en, ms). Indexed by
// surah number; index 0 is a placeholder to align with SURAH_NAMES.
export const SURAH_NAMES_LATIN: readonly string[] = [
  "",
  "Al-Fatihah",
  "Al-Baqarah",
  "Ali 'Imran",
  "An-Nisa",
  "Al-Ma'idah",
  "Al-An'am",
  "Al-A'raf",
  "Al-Anfal",
  "At-Tawbah",
  "Yunus",
  "Hud",
  "Yusuf",
  "Ar-Ra'd",
  "Ibrahim",
  "Al-Hijr",
  "An-Nahl",
  "Al-Isra",
  "Al-Kahf",
  "Maryam",
  "Taha",
  "Al-Anbya",
  "Al-Hajj",
  "Al-Mu'minun",
  "An-Nur",
  "Al-Furqan",
  "Ash-Shu'ara",
  "An-Naml",
  "Al-Qasas",
  "Al-'Ankabut",
  "Ar-Rum",
  "Luqman",
  "As-Sajdah",
  "Al-Ahzab",
  "Saba",
  "Fatir",
  "Ya-Sin",
  "As-Saffat",
  "Sad",
  "Az-Zumar",
  "Ghafir",
  "Fussilat",
  "Ash-Shuraa",
  "Az-Zukhruf",
  "Ad-Dukhan",
  "Al-Jathiyah",
  "Al-Ahqaf",
  "Muhammad",
  "Al-Fath",
  "Al-Hujurat",
  "Qaf",
  "Adh-Dhariyat",
  "At-Tur",
  "An-Najm",
  "Al-Qamar",
  "Ar-Rahman",
  "Al-Waqi'ah",
  "Al-Hadid",
  "Al-Mujadila",
  "Al-Hashr",
  "Al-Mumtahanah",
  "As-Saf",
  "Al-Jumu'ah",
  "Al-Munafiqun",
  "At-Taghabun",
  "At-Talaq",
  "At-Tahrim",
  "Al-Mulk",
  "Al-Qalam",
  "Al-Haqqah",
  "Al-Ma'arij",
  "Nuh",
  "Al-Jinn",
  "Al-Muzzammil",
  "Al-Muddaththir",
  "Al-Qiyamah",
  "Al-Insan",
  "Al-Mursalat",
  "An-Naba",
  "An-Nazi'at",
  "'Abasa",
  "At-Takwir",
  "Al-Infitar",
  "Al-Mutaffifin",
  "Al-Inshiqaq",
  "Al-Buruj",
  "At-Tariq",
  "Al-A'la",
  "Al-Ghashiyah",
  "Al-Fajr",
  "Al-Balad",
  "Ash-Shams",
  "Al-Layl",
  "Ad-Duhaa",
  "Ash-Sharh",
  "At-Tin",
  "Al-'Alaq",
  "Al-Qadr",
  "Al-Bayyinah",
  "Az-Zalzalah",
  "Al-'Adiyat",
  "Al-Qari'ah",
  "At-Takathur",
  "Al-'Asr",
  "Al-Humazah",
  "Al-Fil",
  "Quraysh",
  "Al-Ma'un",
  "Al-Kawthar",
  "Al-Kafirun",
  "An-Nasr",
  "Al-Masad",
  "Al-Ikhlas",
  "Al-Falaq",
  "An-Nas",
] as const;

export const DOWNLOAD_CONCURRENCY = 6;
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAYS_MS = [1000, 3000, 10000];
export const MIN_PAGES_BEFORE_READING = 5;
