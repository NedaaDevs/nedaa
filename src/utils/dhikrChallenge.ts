import { ChallengeDifficulty, DhikrPhrase, DHIKR_PHRASES } from "@/types/alarm";

// Forgiving normalization: lowercase, drop Arabic diacritics + tatweel, keep
// only letters (spaces, apostrophes, hyphens, digits, punctuation removed).
// The Android overlay applies the same rule in Kotlin.
export const normalizeDhikr = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[^\p{L}]/gu, "");

// Matches when the input equals either the transliteration or the Arabic form
// under the same normalization, so both keyboards work.
export const matchesDhikr = (input: string, phrase: DhikrPhrase): boolean => {
  const normalized = normalizeDhikr(input);
  if (normalized.length === 0) return false;
  return (
    normalized === normalizeDhikr(phrase.transliteration) ||
    normalized === normalizeDhikr(phrase.arabic)
  );
};

// Random phrase from the difficulty pool, avoiding an immediate repeat.
export const pickDhikrPhrase = (
  difficulty: ChallengeDifficulty,
  previous?: DhikrPhrase | null
): DhikrPhrase => {
  const pool = DHIKR_PHRASES[difficulty];
  if (pool.length <= 1) return pool[0];
  let choice = pool[Math.floor(Math.random() * pool.length)];
  while (previous && choice.transliteration === previous.transliteration) {
    choice = pool[Math.floor(Math.random() * pool.length)];
  }
  return choice;
};
