import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import { DHIKR_STRIKE_LIMIT, DHIKR_TYPED } from "@/constants/DhikrTask";
import { DHIKR_PHRASES, DhikrPhrase } from "@/types/alarm";
import { matchesDhikr, normalizeDhikr, pickDhikrPhrase, submitDhikr } from "@/utils/dhikrChallenge";

// The Android overlay's JVM test reads the same tables.
const FIXTURES = join(__dirname, "..", "..", "..", "modules", "expo-alarm", "fixtures");

// Rows of a tab-separated fixture, header dropped.
const readCases = (file: string): string[][] =>
  readFileSync(join(FIXTURES, file), "utf8")
    .split("\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));

const normalizeCases = readCases("dhikr-normalize.tsv");
const matchCases = readCases("dhikr-match.tsv");
const typedCases = readCases("dhikr-typed.tsv");
const phraseRows = readCases("dhikr-phrases.tsv");

// The tables' words: an empty submission, and the cell separator.
const FORMAT = { EMPTY: "-", SEPARATOR: "|" } as const;
const phrases = Object.values(DHIKR_PHRASES).flat();

describe("normalizeDhikr", () => {
  it.each(normalizeCases)("normalizes %s: %s", (_case, input, normalized) => {
    expect(normalizeDhikr(input)).toBe(normalized);
  });

  it("returns an empty string for whitespace and punctuation only", () => {
    expect(normalizeDhikr("   -- '' ")).toBe("");
  });
});

describe("matchesDhikr", () => {
  it.each(matchCases)("%s: %s", (_case, typed, arabic, transliteration, matches) => {
    expect(String(matchesDhikr(typed, { arabic, transliteration }))).toBe(matches);
  });

  it("draws its shared cases from every challenge phrase", () => {
    const listed = matchCases.map(([, , arabic, transliteration]) => ({ arabic, transliteration }));
    for (const phrase of listed) expect(phrases).toContainEqual(phrase);
    expect(new Set(listed.map(({ arabic }) => arabic))).toEqual(
      new Set(phrases.map(({ arabic }) => arabic))
    );
  });

  it.each(phrases.map((phrase) => [phrase.transliteration, phrase] as const))(
    "%s matches its own phrase and no other",
    (_name, phrase) => {
      const matchedBy = (typed: string) => phrases.filter((target) => matchesDhikr(typed, target));
      expect(matchedBy(phrase.arabic)).toEqual([phrase]);
      expect(matchedBy(phrase.transliteration)).toEqual([phrase]);
    }
  );
});

describe("pickDhikrPhrase", () => {
  it("returns a phrase from the requested difficulty pool", () => {
    const phrase = pickDhikrPhrase("medium");
    expect(DHIKR_PHRASES.medium).toContainEqual(phrase);
  });

  it("never repeats the previous phrase across many picks (multi-item pool)", () => {
    let previous: DhikrPhrase | null = DHIKR_PHRASES.easy[0];
    for (let i = 0; i < 200; i++) {
      const next = pickDhikrPhrase("easy", previous);
      expect(next.transliteration).not.toBe(previous!.transliteration);
      previous = next;
    }
  });

  it("returns the other phrase for a two-item pool", () => {
    const next = pickDhikrPhrase("hard", DHIKR_PHRASES.hard[0]);
    expect(next.transliteration).toBe(DHIKR_PHRASES.hard[1].transliteration);
  });
});

describe("submitDhikr", () => {
  it.each(typedCases)("%s", (_case, arabic, transliteration, typed, outcomes) => {
    const phrase = { arabic, transliteration };
    let strikes = 0;
    const seen = typed.split(FORMAT.SEPARATOR).map((cell) => {
      const result = submitDhikr(cell === FORMAT.EMPTY ? "" : cell, phrase, strikes);
      strikes = result.strikes;
      return result.outcome;
    });
    expect(seen.join(FORMAT.SEPARATOR)).toBe(outcomes);
  });

  it("draws a new phrase on the strike limit and no sooner", () => {
    const phrase = DHIKR_PHRASES.easy[0];
    const last = submitDhikr("", phrase, DHIKR_STRIKE_LIMIT - 1);
    expect(last).toEqual({ outcome: DHIKR_TYPED.NEXT, strikes: 0 });
    expect(submitDhikr("", phrase, DHIKR_STRIKE_LIMIT - 2).outcome).toBe(DHIKR_TYPED.WRONG);
  });
});

describe("DHIKR_PHRASES", () => {
  it("is the pool the Android overlay types, in order", () => {
    const rows = Object.values(CHALLENGE_DIFFICULTY).flatMap((difficulty) =>
      DHIKR_PHRASES[difficulty].map(({ arabic, transliteration }) => [
        difficulty,
        arabic,
        transliteration,
      ])
    );
    expect(rows).toEqual(phraseRows);
  });
});
