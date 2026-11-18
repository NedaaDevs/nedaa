import { DHIKR_TEXT } from "@/constants/AthkarSession";
import { AppLocale } from "@/enums/app";

/** A dhikr's words: a locale key holding a translation over the Arabic, or the words themselves. */
export type DhikrText =
  | { kind: typeof DHIKR_TEXT.KEY; key: string }
  | { kind: typeof DHIKR_TEXT.RAW; arabic: string; translation: string | null };

export const keyText = (key: string): DhikrText => ({ kind: DHIKR_TEXT.KEY, key });

type DhikrWords = { arabic: string; translation: string | null };

export const splitAthkarText = (text: string, locale: string): DhikrWords => {
  if (locale === AppLocale.AR) return { arabic: text, translation: null };

  const parts = text.split("\n");
  if (parts.length >= 2) {
    return {
      arabic: parts[parts.length - 1].trim(),
      translation: parts.slice(0, -1).join("\n").trim(),
    };
  }

  return { arabic: text, translation: null };
};

/** A dhikr's Arabic and its translation; Arabic shows no translation. */
export const resolveDhikrText = (
  text: DhikrText,
  t: (key: string) => string,
  locale: string
): DhikrWords => {
  switch (text.kind) {
    case DHIKR_TEXT.KEY:
      return splitAthkarText(t(text.key), locale);
    case DHIKR_TEXT.RAW:
      return {
        arabic: text.arabic,
        translation: locale === AppLocale.AR ? null : text.translation || null,
      };
  }
};

/** The one line that names a dhikr: its translation where translations show, else its Arabic. */
export const athkarLine = (
  text: DhikrText,
  t: (key: string) => string,
  locale: string,
  showTranslation: boolean
): string => {
  const { arabic, translation } = resolveDhikrText(text, t, locale);
  return showTranslation && translation ? translation.split("\n")[0] : arabic;
};
