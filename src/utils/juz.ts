import i18n from "@/localization/i18n";
import { toArabicDigits } from "@/constants/Quran";
import { formatNumberToLocale } from "@/utils/number";

// Juz furniture for the reader, computed without a DB call. Juz boundaries are
// fixed across the Madinah 604-page mushaf, so the juz for a page is a pure
// lookup against its start pages (verified against quran.db's divisions).

// Start page of each juz, indexed by juz - 1.
const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402,
  422, 442, 462, 482, 502, 522, 542, 562, 582,
] as const;

// Arabic ordinals 1–30 ("الجزء الأول"), indexed by juz - 1. Irregular, so listed
// rather than computed.
const JUZ_ORDINALS = [
  "الأول",
  "الثاني",
  "الثالث",
  "الرابع",
  "الخامس",
  "السادس",
  "السابع",
  "الثامن",
  "التاسع",
  "العاشر",
  "الحادي عشر",
  "الثاني عشر",
  "الثالث عشر",
  "الرابع عشر",
  "الخامس عشر",
  "السادس عشر",
  "السابع عشر",
  "الثامن عشر",
  "التاسع عشر",
  "العشرون",
  "الحادي والعشرون",
  "الثاني والعشرون",
  "الثالث والعشرون",
  "الرابع والعشرون",
  "الخامس والعشرون",
  "السادس والعشرون",
  "السابع والعشرون",
  "الثامن والعشرون",
  "التاسع والعشرون",
  "الثلاثون",
] as const;

// The juz (1–30) a page belongs to.
export const juzForPage = (page: number): number => {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGES.length && page >= JUZ_START_PAGES[i]; i++) {
    juz = i + 1;
  }
  return juz;
};

// Rub number (1..240) → its hizb (1..60) and quarter position within it
// (0 = hizb start, 1 = ¼, 2 = ½, 3 = ¾).
export const rubForHizbQuarter = (rub: number): { hizb: number; quarter: 0 | 1 | 2 | 3 } => {
  const hizb = Math.floor((rub - 1) / 4) + 1;
  const quarter = ((rub - 1) % 4) as 0 | 1 | 2 | 3;
  return { hizb, quarter };
};

// Reduced quarter fractions: ¼, ½, ¾ — a hizb start (quarter 0) shows no fraction.
const QUARTER_FRACTION_AR = ["", "١/٤", "١/٢", "٣/٤"] as const;
const QUARTER_FRACTION_LATIN = ["", "1/4", "1/2", "3/4"] as const;

// Localized hizb-quarter label for the footer holder: «٣/٤ الحزب ١» in Arabic,
// "3/4 Hizb 1" elsewhere; hizb starts show just the hizb.
export const rubLabel = (rub: number): string => {
  const { hizb, quarter } = rubForHizbQuarter(rub);
  if (i18n.language === "ar") {
    const h = `الحزب ${toArabicDigits(hizb)}`;
    return quarter === 0 ? h : `${QUARTER_FRACTION_AR[quarter]} ${h}`;
  }
  const h = i18n.t("quran.goto.hizbLabel", { n: formatNumberToLocale(String(hizb)) });
  return quarter === 0 ? h : `${QUARTER_FRACTION_LATIN[quarter]} ${h}`;
};

// Localized running-header juz label. Arabic keeps the mushaf-authentic ordinal
// ("الجزء الأول"); other locales use their word + number ("Juz 5", "پارہ 5").
export const juzLabel = (juz: number): string => {
  if (i18n.language === "ar") {
    const ordinal = JUZ_ORDINALS[juz - 1];
    return ordinal ? `الجزء ${ordinal}` : "";
  }
  return juz >= 1 && juz <= 30
    ? i18n.t("quran.goto.juzLabel", { n: formatNumberToLocale(String(juz)) })
    : "";
};

// Running-header variant of juzLabel with its own English wording.
export const headerJuzLabel = (juz: number): string => {
  if (i18n.language === "en") {
    return juz >= 1 && juz <= 30 ? i18n.t("quran.header.partLabel", { n: juz }) : "";
  }
  return juzLabel(juz);
};
