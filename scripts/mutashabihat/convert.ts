// Pure converter: QUL mutashabihat export (phrases.json) → de-duplicated groups
// keyed by content (the verse set sharing a phrase). No RN/sqlite imports.
//
// A QUL "phrase" is a >=3-word sequence occurring in >=2 verses, with the word
// positions of the shared span in each verse. We:
//   - drop common collocations (short phrases shared by many verses),
//   - merge phrases that span the SAME verse set (union their spans), so two
//     near-identical verses sharing several phrases become one group, and
//   - keep the per-verse spans so the reader can highlight the shared wording.

export type Span = [number, number]; // 1-based [fromWord, toWord], inclusive

export type QulPhrase = {
  source: { key: string; from: number; to: number };
  ayah: Record<string, Span[]>;
};
export type QulPhrases = Record<string, QulPhrase>;

export type SeedMember = { key: string; spans: Span[] };
export type SeedGroup = {
  id: string; // canonical: sorted member verse-keys joined by ','
  members: SeedMember[];
};

const byVerseKey = (a: string, b: string): number => {
  const [as, aa] = a.split(":").map(Number);
  const [bs, ba] = b.split(":").map(Number);
  return as - bs || aa - ba;
};

// A phrase is worth keeping if it's distinctive: >=4 words, or a 3-word phrase
// shared by only a few verses. Long shared refrains (many verses) stay.
const isDistinctive = (phrase: QulPhrase): boolean => {
  const len = phrase.source.to - phrase.source.from + 1;
  const members = Object.keys(phrase.ayah).length;
  if (members < 2) return false;
  return len >= 4 || members <= 6;
};

const dedupeSpans = (spans: Span[]): Span[] => {
  const seen = new Set<string>();
  const out: Span[] = [];
  for (const s of [...spans].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const k = `${s[0]}-${s[1]}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
};

export const convertQulPhrases = (phrases: QulPhrases): SeedGroup[] => {
  // member-set id -> per-verse spans (unioned across phrases with that set)
  const byId = new Map<string, Map<string, Span[]>>();

  for (const phrase of Object.values(phrases)) {
    if (!isDistinctive(phrase)) continue;
    const keys = Object.keys(phrase.ayah).sort(byVerseKey);
    const id = keys.join(",");
    let spansByKey = byId.get(id);
    if (!spansByKey) {
      spansByKey = new Map<string, Span[]>();
      byId.set(id, spansByKey);
    }
    for (const key of keys) {
      const prev = spansByKey.get(key) ?? [];
      spansByKey.set(key, [...prev, ...phrase.ayah[key]]);
    }
  }

  const groups: SeedGroup[] = [];
  for (const [id, spansByKey] of byId) {
    const members = [...spansByKey.keys()]
      .sort(byVerseKey)
      .map((key) => ({ key, spans: dedupeSpans(spansByKey.get(key)!) }));
    groups.push({ id, members });
  }
  return groups;
};
