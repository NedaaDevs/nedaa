import { ChallengeDifficulty, DhikrPhrase, DHIKR_PHRASES } from "@/types/alarm";

// Forgiving: letters only, no diacritics, one spelling per Arabic letter
// family, and a doubled letter counts once. Mirrored in the Android overlay.
export const normalizeDhikr = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/[^\p{L}]|\u0621/gu, "")
    .replace(/(\p{L})\1+/gu, "$1");

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
