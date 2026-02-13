import { createFont, createTamagui, createTokens } from "tamagui";
import { createAnimations } from "@tamagui/animations-moti";
import { defaultConfig } from "@tamagui/config/v5";

// Fonts — weight-to-face mappings for locale-aware font switching
// FontLanguage component handles runtime switching: wrap content with
// <FontLanguage body="ar" heading="ar"> to switch to Arabic fonts.
const asapFont = createFont({
  family: "Asap-Regular",
  size: {
    1: 10, // 2xs
    2: 12, // xs
    3: 14, // sm
    4: 16, // base
    5: 18, // lg
    6: 20, // xl
    7: 24, // 2xl
    8: 30, // 3xl
    9: 36, // 4xl
    10: 48, // 5xl
    true: 16, // default
  },
  lineHeight: {
    1: 14,
    2: 16,
    3: 20,
    4: 24,
    5: 28,
    6: 28,
    7: 32,
    8: 36,
    9: 40,
    10: 48,
    true: 24,
  },
  weight: {
    1: "400", // regular
    2: "500", // medium
    3: "600", // semibold
    4: "700", // bold
    true: "400",
  },
  letterSpacing: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    true: 0,
  },
  face: {
    400: { normal: "Asap-Regular" },
    500: { normal: "Asap-Medium" },
    600: { normal: "Asap-SemiBold" },
    700: { normal: "Asap-Bold" },
  },
});

const ibmPlexSansFont = createFont({
  family: "IBMPlexSans-Regular",
  size: {
    1: 10,
    2: 12,
    3: 14,
    4: 16,
    5: 18,
    6: 20,
    7: 24,
    8: 30,
    9: 36,
    10: 48,
    true: 16,
  },
  lineHeight: {
    1: 14,
    2: 16,
    3: 20,
    4: 24,
    5: 28,
    6: 28,
    7: 32,
    8: 36,
    9: 40,
    10: 48,
    true: 24,
  },
  weight: {
    1: "400",
    2: "500",
    3: "600",
    4: "700",
    true: "400",
  },
  letterSpacing: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    true: 0,
  },
  face: {
    400: { normal: "IBMPlexSans-Regular" },
    500: { normal: "IBMPlexSans-Medium" },
    600: { normal: "IBMPlexSans-SemiBold" },
    700: { normal: "IBMPlexSans-Bold" },
  },
});

const monoFont = createFont({
  family: "monospace",
  size: { ...asapFont.size },
  lineHeight: { ...asapFont.lineHeight },
  weight: { ...asapFont.weight },
  letterSpacing: { ...asapFont.letterSpacing },
  face: {
    400: { normal: "monospace" },
    700: { normal: "monospace" },
  },
});

// Tokens
const tokens = createTokens({
  size: {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
    true: 16,
  },
  space: {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    true: 16,
    "-0.5": -2,
    "-1": -4,
    "-1.5": -6,
    "-2": -8,
    "-2.5": -10,
    "-3": -12,
    "-3.5": -14,
    "-4": -16,
    "-5": -20,
    "-6": -24,
  },
  radius: {
    0: 0,
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    5: 10,
    6: 12,
    7: 16,
    8: 20,
    9: 24,
    10: 999,
    true: 8,
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
  color: {
    transparent: "transparent",
    white: "#FFFFFF",
    black: "#000000",

    // Light theme colors
    lightPrimary: "#1C5D85",
    lightSecondary: "#1C5D7D",
    lightTypography: "#1C5D85",
    lightTypographySecondary: "#64748B",
    lightTypographyContrast: "#FFFFFF",
    lightBackground: "#F5F7FA",
    lightBackgroundSecondary: "#FFFFFF",
    lightBackgroundElevated: "#1C5D85",
    lightBackgroundInteractive: "#F5F7FA",
    lightOutline: "#E2E8F0",
    lightOutlineAccent: "#1C5D85",
    lightSurfaceHover: "#F9FAFB",
    lightSurfaceActive: "#F3F4F6",
    lightAccentPrimary: "#1C5D7D",
    lightError: "#DC2626",
    lightSuccess: "#16A34A",
    lightWarning: "#D97706",
    lightInfo: "#2563EB",
    lightBackgroundError: "#FEE2E2",
    lightBackgroundSuccess: "#DCFCE7",
    lightBackgroundWarning: "#FEF3C7",
    lightBackgroundInfo: "#DBEAFE",
    lightBackgroundInfoEmphasis: "#93C5FD",
    lightBackgroundMuted: "#F3F4F6",
    lightBorderError: "#EF4444",
    lightBorderSuccess: "#22C55E",
    lightBorderWarning: "#F59E0B",
    lightBorderInfo: "#3B82F6",

    // Dark theme colors
    darkPrimary: "#E6C469",
    darkSecondary: "#D4BA76",
    darkTypography: "#E6C469",
    darkTypographySecondary: "#E3E2CE",
    darkTypographyContrast: "#FFFFFF",
    darkBackground: "#222831",
    darkBackgroundSecondary: "#393E46",
    darkBackgroundElevated: "#393E46",
    darkBackgroundInteractive: "#222831",
    darkOutline: "rgba(255, 255, 255, 0.1)",
    darkOutlineAccent: "#E6C469",
    darkSurfaceHover: "#374151",
    darkSurfaceActive: "#4B5563",
    darkAccentPrimary: "#E6C469",
    darkError: "#FCA5A5",
    darkSuccess: "#86EFAC",
    darkWarning: "#FCD34D",
    darkInfo: "#93C5FD",
    darkBackgroundError: "#7F1D1D",
    darkBackgroundSuccess: "#14532D",
    darkBackgroundWarning: "#78350F",
    darkBackgroundInfo: "#1E3A8A",
    darkBackgroundInfoEmphasis: "#2563EB",
    darkBackgroundMuted: "#1F2937",
    darkBorderError: "#EF4444",
    darkBorderSuccess: "#22C55E",
    darkBorderWarning: "#F59E0B",
    darkBorderInfo: "#3B82F6",
  },
});

// Themes — v5 base keys + custom semantic tokens
// Spread v5 defaults first (provides color1-12, interactive states, named color scales),
// then layer custom semantic keys on top (our values win on conflicts).
const lightTheme = {
  ...defaultConfig.themes.light,

  primary: tokens.color.lightPrimary,
  secondary: tokens.color.lightSecondary,

  typography: tokens.color.lightTypography,
  typographySecondary: tokens.color.lightTypographySecondary,
  typographyContrast: tokens.color.lightTypographyContrast,

  background: tokens.color.lightBackground,
  backgroundSecondary: tokens.color.lightBackgroundSecondary,
  backgroundElevated: tokens.color.lightBackgroundElevated,
  backgroundInteractive: tokens.color.lightBackgroundInteractive,
  backgroundError: tokens.color.lightBackgroundError,
  backgroundSuccess: tokens.color.lightBackgroundSuccess,
  backgroundWarning: tokens.color.lightBackgroundWarning,
  backgroundInfo: tokens.color.lightBackgroundInfo,
  backgroundMuted: tokens.color.lightBackgroundMuted,
  backgroundPrimary: tokens.color.lightBackgroundSecondary,

  // v5 interactive states — override with brand colors
  backgroundHover: tokens.color.lightSurfaceHover,
  backgroundPress: tokens.color.lightSurfaceActive,
  backgroundActive: tokens.color.lightSurfaceActive,
  colorHover: tokens.color.lightTypography,
  colorPress: tokens.color.lightTypography,
  colorFocus: tokens.color.lightTypography,
  borderColorHover: tokens.color.lightOutline,
  borderColorPress: tokens.color.lightOutlineAccent,
  borderColorFocus: tokens.color.lightOutlineAccent,

  outline: tokens.color.lightOutline,
  outlineSecondary: tokens.color.lightOutline,
  borderError: tokens.color.lightBorderError,
  borderSuccess: tokens.color.lightBorderSuccess,
  borderWarning: tokens.color.lightBorderWarning,
  borderInfo: tokens.color.lightBorderInfo,

  surfaceActive: tokens.color.lightSurfaceActive,

  accentPrimary: tokens.color.lightAccentPrimary,

  error: tokens.color.lightError,
  success: tokens.color.lightSuccess,
  warning: tokens.color.lightWarning,
  info: tokens.color.lightInfo,

  primarySubtle: "rgba(28, 93, 133, 0.1)",
  warningSubtle: "rgba(217, 119, 6, 0.05)",

  // Semantic aliases for Tamagui built-in components
  color: tokens.color.lightTypography,
  borderColor: tokens.color.lightOutline,
  shadowColor: "rgba(38, 38, 38, 0.1)",
  placeholderColor: tokens.color.lightTypographySecondary,
};

const darkTheme = {
  ...defaultConfig.themes.dark,

  primary: tokens.color.darkPrimary,
  secondary: tokens.color.darkSecondary,

  typography: tokens.color.darkTypography,
  typographySecondary: tokens.color.darkTypographySecondary,
  typographyContrast: tokens.color.darkTypographyContrast,

  background: tokens.color.darkBackground,
  backgroundSecondary: tokens.color.darkBackgroundSecondary,
  backgroundElevated: tokens.color.darkBackgroundElevated,
  backgroundInteractive: tokens.color.darkBackgroundInteractive,
  backgroundError: tokens.color.darkBackgroundError,
  backgroundSuccess: tokens.color.darkBackgroundSuccess,
  backgroundWarning: tokens.color.darkBackgroundWarning,
  backgroundInfo: tokens.color.darkBackgroundInfo,
  backgroundMuted: tokens.color.darkBackgroundMuted,
  backgroundPrimary: tokens.color.darkBackgroundSecondary,

  // v5 interactive states — override with brand colors
  backgroundHover: tokens.color.darkSurfaceHover,
  backgroundPress: tokens.color.darkSurfaceActive,
  backgroundActive: tokens.color.darkSurfaceActive,
  colorHover: tokens.color.darkTypography,
  colorPress: tokens.color.darkTypography,
  colorFocus: tokens.color.darkTypography,
  borderColorHover: tokens.color.darkOutline,
  borderColorPress: tokens.color.darkOutlineAccent,
  borderColorFocus: tokens.color.darkOutlineAccent,

  outline: tokens.color.darkOutline,
  outlineSecondary: tokens.color.darkOutline,
  borderError: tokens.color.darkBorderError,
  borderSuccess: tokens.color.darkBorderSuccess,
  borderWarning: tokens.color.darkBorderWarning,
  borderInfo: tokens.color.darkBorderInfo,

  surfaceActive: tokens.color.darkSurfaceActive,

  accentPrimary: tokens.color.darkAccentPrimary,

  error: tokens.color.darkError,
  success: tokens.color.darkSuccess,
  warning: tokens.color.darkWarning,
  info: tokens.color.darkInfo,

  primarySubtle: "rgba(230, 196, 105, 0.1)",
  warningSubtle: "rgba(252, 211, 77, 0.05)",

  // Semantic aliases for Tamagui built-in components
  color: tokens.color.darkTypography,
  borderColor: tokens.color.darkOutline,
  shadowColor: "rgba(0, 0, 0, 0.3)",
  placeholderColor: tokens.color.darkTypographySecondary,
};

// Animations (moti driver — reuses existing react-native-reanimated)
const animations = createAnimations({
  fast: {
    type: "spring",
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  medium: {
    type: "spring",
    damping: 15,
    mass: 0.9,
    stiffness: 150,
  },
  slow: {
    type: "spring",
    damping: 20,
    stiffness: 60,
  },
  bouncy: {
    type: "spring",
    damping: 9,
    mass: 0.9,
    stiffness: 150,
  },
  lazy: {
    type: "spring",
    damping: 18,
    stiffness: 50,
  },
  tooltip: {
    type: "spring",
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
});

const config = createTamagui({
  tokens,
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  fonts: {
    heading: asapFont,
    heading_ar: ibmPlexSansFont,
    body: asapFont,
    body_ar: ibmPlexSansFont,
    mono: monoFont,
  },
  fontLanguages: ["ar"],
  animations,
  media: {
    sm: { maxWidth: 640 },
    md: { maxWidth: 768 },
    lg: { maxWidth: 1024 },
    short: { maxHeight: 820 },
    hoverNone: { hover: "none" },
    pointerCoarse: { pointer: "coarse" },
  },
  shorthands: {
    // v5 standard shorthands
    ...defaultConfig.shorthands,
    // Custom shorthands (aliases for common patterns)
    br: "borderRadius",
    f: "flex",
    w: "width",
    h: "height",
    ai: "alignItems",
    jc: "justifyContent",
    ac: "alignContent",
    as: "alignSelf",
    fd: "flexDirection",
    fw: "flexWrap",
  } as const,
  settings: {
    ...defaultConfig.settings,
    disableSSR: true,
    onlyAllowShorthands: false,
    defaultFont: "body",
    fastSchemeChange: true,
    styleCompat: "react-native",
  },
});

export default config;

type AppConfig = typeof config;

declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppConfig {}
}
