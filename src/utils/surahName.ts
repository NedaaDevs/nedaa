import i18n from "@/localization/i18n";
import { SURAH_NAMES, SURAH_NAMES_LATIN, QURAN_FONT_FAMILY } from "@/constants/Quran";

// Locales whose metadata renders in Arabic script (vs Latin transliteration).
const ARABIC_SCRIPT_LANGUAGES = ["ar", "ur"];

const isArabicScript = (): boolean => ARABIC_SCRIPT_LANGUAGES.includes(i18n.language);

// Surah name in the app locale's script: Arabic for ar/ur, transliterated Latin for en/ms.
export const localizedSurahName = (surahNumber: number): string =>
  (isArabicScript() ? SURAH_NAMES : SURAH_NAMES_LATIN)[surahNumber] ?? String(surahNumber);

// Header-metadata font: scripture font renders Arabic-script names; app font renders Latin.
export const metadataFontFamily = (): string | undefined =>
  isArabicScript() ? QURAN_FONT_FAMILY : undefined;
