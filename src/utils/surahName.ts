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

export const SURAH_NAME_LIGATURE_FONT = "SurahNames";

// GSUB ligature token the SurahNames font turns into the calligraphic vocalized
// «سورة …» glyph. Null for Latin locales (they keep transliterated text).
export const surahNameLigature = (surahNumber: number): string | null =>
  isArabicScript() && surahNumber >= 1 && surahNumber <= 114
    ? `surah${String(surahNumber).padStart(3, "0")} surah-icon`
    : null;
