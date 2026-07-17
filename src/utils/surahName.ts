import i18n from "@/localization/i18n";
import {
  SURAH_NAMES,
  SURAH_NAMES_LATIN,
  SURAH_NAMES_VOCALIZED,
  QURAN_FONT_FAMILY,
} from "@/constants/Quran";

// Locales whose metadata renders in Arabic script (vs Latin transliteration).
const ARABIC_SCRIPT_LANGUAGES = ["ar", "ur"];

const isArabicScript = (): boolean => ARABIC_SCRIPT_LANGUAGES.includes(i18n.language);

// Surah name in the app locale's script: Arabic for ar/ur, transliterated Latin for en/ms.
export const localizedSurahName = (surahNumber: number): string =>
  (isArabicScript() ? SURAH_NAMES : SURAH_NAMES_LATIN)[surahNumber] ?? String(surahNumber);

// Header-metadata font: scripture font renders Arabic-script names; app font renders Latin.
export const metadataFontFamily = (): string | undefined =>
  isArabicScript() ? QURAN_FONT_FAMILY : undefined;

// Running-header surah label: Arabic-script locales get the vocalized print
// form after «سُورَةُ»; Latin locales get the localized "Surah X".
export const headerSurahLabel = (surahNumber: number): string => {
  const vocalized = SURAH_NAMES_VOCALIZED[surahNumber];
  if (isArabicScript() && vocalized) {
    return i18n.language === "ar"
      ? `سُورَةُ ${vocalized}`
      : `${i18n.t("quran.goto.surah")} ${vocalized}`;
  }
  return `${i18n.t("quran.goto.surah")} ${localizedSurahName(surahNumber)}`;
};

export const SURAH_NAME_LIGATURE_FONT = "SurahNames";
export const JUZ_NAME_LIGATURE_FONT = "QuranCommon";

// GSUB ligature token QuranCommon turns into the calligraphic vocalized
// «الجزء …» glyph. Null for Latin locales.
export const juzNameLigature = (juz: number): string | null =>
  isArabicScript() && juz >= 1 && juz <= 30 ? `juz${String(juz).padStart(3, "0")}` : null;

// GSUB ligature token the SurahNames font turns into the calligraphic vocalized
// «سورة …» glyph. Null for Latin locales (they keep transliterated text).
export const surahNameLigature = (surahNumber: number): string | null =>
  isArabicScript() && surahNumber >= 1 && surahNumber <= 114
    ? `surah${String(surahNumber).padStart(3, "0")} surah-icon`
    : null;
