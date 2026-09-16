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
