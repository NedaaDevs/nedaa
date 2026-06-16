import tajweed from "../../assets/guide/tajweed.json";
import waqf from "../../assets/guide/waqf.json";
import sajda from "../../assets/guide/sajda.json";

import { GuideCategory, GuideEntry } from "@/types/guide";

// Bundled reference-guide content. Structure only (text lives in i18n keyed by id).
// A thin CDN refresh could later merge over this by `id`; same shape either way.
const ALL = [...tajweed, ...waqf, ...sajda] as unknown as GuideEntry[];

// Display order of categories in the browsable Guide.
export const GUIDE_CATEGORY_ORDER: GuideCategory[] = [
  GuideCategory.TAJWEED,
  GuideCategory.WAQF,
  GuideCategory.SAJDA,
];

// The 15 ayahs of prostration (sujood al-tilawah). Used to flag a page that
// contains a sajda, so the reader can offer the sajda explanation + dua.
// NOTE: counting differs slightly between schools — verify before shipping.
export const SAJDA_AYAHS: { surah: number; ayah: number }[] = [
  { surah: 7, ayah: 206 },
  { surah: 13, ayah: 15 },
  { surah: 16, ayah: 50 },
  { surah: 17, ayah: 109 },
  { surah: 19, ayah: 58 },
  { surah: 22, ayah: 18 },
  { surah: 22, ayah: 77 },
  { surah: 25, ayah: 60 },
  { surah: 27, ayah: 26 },
  { surah: 32, ayah: 15 },
  { surah: 38, ayah: 24 },
  { surah: 41, ayah: 38 },
  { surah: 53, ayah: 62 },
  { surah: 84, ayah: 21 },
  { surah: 96, ayah: 19 },
];

export const guideEntriesByCategory = (category: GuideCategory): GuideEntry[] =>
  ALL.filter((e) => e.category === category);

// Tajweed entries keyed by their colour (lowercased hex) — the lookup a tapped
// word's `bounds.tajweed_color` joins against to list its rules.
export const tajweedEntryByColor = (() => {
  const map = new Map<string, GuideEntry>();
  for (const e of ALL) {
    if (e.category === GuideCategory.TAJWEED && e.color) map.set(e.color.toLowerCase(), e);
  }
  return (hex: string): GuideEntry | undefined => map.get(hex.toLowerCase());
})();

const BY_ID = new Map(ALL.map((e) => [e.id, e]));
export const guideEntryById = (id: string): GuideEntry | undefined => BY_ID.get(id);

// Mushaf waqf-mark codepoints → guide entry id. The Uthmani text carries these
// small high signs (U+06D6–U+06DA); tapping one in Text mode opens its entry.
const WAQF_CHAR_TO_ID: Record<string, string> = {
  "ۖ": "waqf.wasl_awla", // ۖ صلى — continuing preferred
  "ۗ": "waqf.waqf_awla", // ۗ قلى — stopping preferred
  "ۘ": "waqf.lazim", // ۘ مـ — compulsory stop
  "ۙ": "waqf.la", // ۙ لا — do not stop
  "ۚ": "waqf.jaiz", // ۚ ج — permissible stop
};

export const WAQF_CHARS: ReadonlySet<string> = new Set(Object.keys(WAQF_CHAR_TO_ID));
export const waqfIdForChar = (ch: string): string | undefined => WAQF_CHAR_TO_ID[ch];
