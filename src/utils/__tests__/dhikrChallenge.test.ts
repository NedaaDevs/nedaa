import { readFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeDhikr, matchesDhikr, pickDhikrPhrase } from "@/utils/dhikrChallenge";
import { DHIKR_PHRASES, DhikrPhrase } from "@/types/alarm";

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
