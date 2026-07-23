import { normalizeDhikr, matchesDhikr, pickDhikrPhrase } from "@/utils/dhikrChallenge";
import { DHIKR_PHRASES, DhikrPhrase } from "@/types/alarm";

const easySubhan = DHIKR_PHRASES.easy[0];

describe("normalizeDhikr", () => {
  it("lowercases and strips spaces", () => {
    expect(normalizeDhikr("Subhanallah")).toBe("subhanallah");
    expect(normalizeDhikr("  SUB HAN allah  ")).toBe("subhanallah");
  });

  it("strips apostrophes and hyphens", () => {
    expect(normalizeDhikr("Subhan'allah")).toBe("subhanallah");
    expect(normalizeDhikr("subhan-allah")).toBe("subhanallah");
  });

  it("strips Arabic diacritics but keeps letters", () => {
    expect(normalizeDhikr("الْحَمْدُ لله")).toBe(normalizeDhikr("الحمد لله"));
  });

  it("returns empty string for whitespace/punctuation only", () => {
    expect(normalizeDhikr("   -- '' ")).toBe("");
  });
});

describe("matchesDhikr", () => {
  it("accepts the exact transliteration", () => {
    expect(matchesDhikr("Subhanallah", easySubhan)).toBe(true);
  });

  it("accepts forgiving transliteration (case, spaces, apostrophes)", () => {
    expect(matchesDhikr("sub han allah", easySubhan)).toBe(true);
    expect(matchesDhikr("SUBHAN'ALLAH", easySubhan)).toBe(true);
  });

  it("accepts the Arabic string", () => {
    expect(matchesDhikr("سبحان الله", easySubhan)).toBe(true);
  });

  it("accepts Arabic with diacritics", () => {
    expect(matchesDhikr("سُبْحَانَ الله", easySubhan)).toBe(true);
  });

  it("rejects empty input", () => {
    expect(matchesDhikr("", easySubhan)).toBe(false);
    expect(matchesDhikr("   ", easySubhan)).toBe(false);
  });

  it("rejects a wrong phrase", () => {
    expect(matchesDhikr("Alhamdulillah", easySubhan)).toBe(false);
  });
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
