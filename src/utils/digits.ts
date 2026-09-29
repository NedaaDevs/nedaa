const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export const toWesternDigits = (str: string) =>
  str.replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)));

export const toArabicIndicDigits = (str: string) =>
  str.replace(/[0-9]/g, (digit) => ARABIC_INDIC_DIGITS[Number(digit)]);

// Western digits are the stored form everywhere, so Arabic is the only locale that
// converts and only when the reader keeps Arabic numerals. Text already written in
// Arabic-Indic digits is deliberate and passes through both ways.
export const localizeDigits = (str: string, locale: string, useWesternNumerals: boolean) =>
  locale.startsWith("ar") && !useWesternNumerals ? toArabicIndicDigits(str) : str;

/** The Unicode left-to-right isolate and the mark that closes it. */
export const LTR_ISOLATE = { OPEN: "\u2066", CLOSE: "\u2069" } as const;

// A Latin number with its sign, and any time, decimal or range joined to it.
const LATIN_NUMBER = /[+\-\u2212]?[0-9]+(?:[:.,\u2013\-\u2212][0-9]+)*/g;

/** Holds each Latin number left to right, so RTL text cannot reorder it. */
export const isolateLatinNumbers = (str: string) =>
  str.replace(LATIN_NUMBER, (number) => `${LTR_ISOLATE.OPEN}${number}${LTR_ISOLATE.CLOSE}`);
