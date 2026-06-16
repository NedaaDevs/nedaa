// Reference-guide ("wiki") content: small, atomic entries explaining a Mushaf
// convention — one tajweed colour, one waqf sign, or one sajda mark per entry.
// Structure lives in assets/guide/*.json; the display text (title/body) lives in
// the i18n locale files under keys derived from the entry id:
//   quran.guide.<id>.title   and   quran.guide.<id>.body
// (release-bound content, so it rides the normal translation pipeline). Fixed,
// non-translated Arabic (a dua's text + transliteration) stays in the JSON.

export const GuideCategory = {
  TAJWEED: "tajweed",
  WAQF: "waqf",
  SAJDA: "sajda",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type GuideCategory = (typeof GuideCategory)[keyof typeof GuideCategory];

export type GuideEntry = {
  // Stable key, e.g. "waqf.lazim", "tajweed.ghunnah". Drives the i18n text keys
  // (quran.guide.<id>.title / .body) and is the CDN merge key.
  id: string;
  category: GuideCategory;
  // The mark itself (waqf/sajda), shown as the entry's glyph.
  symbol?: string;
  // Canonical source hex swatch (tajweed) — reconciled with the generator's V4
  // tajwid palette so it matches what the reader sees.
  color?: string;
  // For supplication entries (the sajda dua): the fixed Arabic text and its Latin
  // transliteration. Non-translated, so they live here, not in i18n.
  arabic?: string;
  transliteration?: string;
};

// The i18n key for an entry's display text: title, body (explanation/meaning),
// or source (localized citation, e.g. "Abu Dawud 1414"). Absent keys → no line.
export const guideTextKey = (id: string, field: "title" | "body" | "source") =>
  `quran.guide.${id}.${field}`;
