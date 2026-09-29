import { ChallengeDifficulty, DhikrPhrase, DHIKR_PHRASES } from "@/types/alarm";

const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

// Applied in order: Urdu \u06C3 folds to \u0629, then to \u0647.
const LETTER_FOLDS: readonly (readonly [RegExp, string])[] = [
  // Urdu and Persian keyboard letters
  [/\u06CC/g, "\u064A"],
  [/\u06A9/g, "\u0643"],
  [/[\u06C1\u06C2\u06BE\u06D5]/g, "\u0647"],
  [/\u06C3/g, "\u0629"],
  // Arabic letter families
  [/[\u0623\u0625\u0622\u0671]/g, "\u0627"],
  [/\u0649/g, "\u064A"],
  [/\u0629/g, "\u0647"],
  [/\u0624/g, "\u0648"],
  [/\u0626/g, "\u064A"],
];

const NON_LETTERS = /[^\p{L}]|\u0621/gu;
const DOUBLED_LETTER = /(\p{L})\1+/gu;

// Forgiving: letters only, no diacritics, one spelling per Arabic letter
// family, and a doubled letter counts once. Mirrored in DhikrMatcher.kt.
export const normalizeDhikr = (input: string): string =>
  LETTER_FOLDS.reduce(
    (text, [letters, letter]) => text.replace(letters, letter),
    input.toLowerCase().replace(DIACRITICS, "")
  )
    .replace(NON_LETTERS, "")
    .replace(DOUBLED_LETTER, "$1");

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
