import i18n from "@/localization/i18n";
import {
  SURAH_NAMES,
  SURAH_NAMES_LATIN,
  SURAH_NAMES_VOCALIZED,
  QURAN_FONT_FAMILY,
} from "@/constants/Quran";
import { MushafVersion } from "@/enums/quran";

// Locales whose metadata renders in Arabic script (vs Latin transliteration).
const ARABIC_SCRIPT_LANGUAGES = ["ar", "ur"];

export const isArabicScript = (): boolean => ARABIC_SCRIPT_LANGUAGES.includes(i18n.language);

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

export const JUZ_NAME_LIGATURE_FONT = "QuranCommon";

// Calligraphic surah-name font per mushaf version (QUL surah-name-v1/v2/v4),
// so the header's name matches the script style of the page it sits above.
const SURAH_NAME_LIGATURE_FONTS: Record<MushafVersion, string> = {
  [MushafVersion.V1]: "SurahNames-v1",
  [MushafVersion.V2]: "SurahNames-v2",
  [MushafVersion.V4]: "SurahNames-v4",
};

export const surahNameLigatureFont = (version: MushafVersion): string =>
  SURAH_NAME_LIGATURE_FONTS[version];

// GSUB ligature token QuranCommon turns into the calligraphic vocalized
// «الجزء …» glyph.
export const juzNameLigature = (juz: number): string | null =>
  juz >= 1 && juz <= 30 ? `juz${String(juz).padStart(3, "0")}` : null;

// GSUB ligature token the version's surah-name font turns into the calligraphic
// vocalized «سورة …» glyph. v1/v4 name glyphs are bare, so the «سورة» word comes
// from the separate surah-icon ligature; v2 bakes the word into the name glyph
// and has no surah-icon ligature (the token would render as literal "-icon").
export const surahNameLigature = (surahNumber: number, version: MushafVersion): string | null => {
  if (surahNumber < 1 || surahNumber > 114) return null;
  const token = `surah${String(surahNumber).padStart(3, "0")}`;
  return version === MushafVersion.V2 ? token : `${token} surah-icon`;
};
