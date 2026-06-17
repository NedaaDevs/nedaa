// Maps a V4 font CPAL palette index (the stable, theme-independent tajweed rule
// key in bounds.db's glyph_bounds.tajweed_index) to a Reference-Guide tajweed
// entry id, supplying the rule name. Swatch colours come from tajweed_palette at
// runtime, so a name is all this table adds.
//
// Derived empirically by joining sole-rule glyphs to their Quran words (the
// font/generator carry no legend by design; QUL's per-word rules are the eventual
// source). NOTE: this QPC V4 font's colours differ from the general/community
// tajweed palette, so slots are keyed by what the recitation rule actually is, not
// by colour name:
//   1/2/15 (greys)  → silent (hamzat wasl, silent letters)
//   3 (#B50000)     → madd lazim, 6 counts            (madda_necessary)
//   9 (#F40000)     → madd muttasil/munfasil, 4–5     (madda_permissible)
//   4 (#FF7B00) + 5 (#CE9E00) → natural madd, 2 counts (madda_normal)
//   6 (#09B000)     → ghunnah (mushaddad noon/meem + ikhfa nasal)
//   7 (#3F48E6)     → tafkhim (heavy raa / lam of Allah / istiʿlaa letters)
//   8 (#2FADFF)     → qalqalah
// Slots 10/11/12 are defined in the palette but never rendered in the 15-line
// Hafs text, so they're intentionally unmapped (would show a generic label).
export const TAJWEED_RULE_BY_INDEX: Record<number, string> = {
  1: "tajweed.silent",
  2: "tajweed.silent",
  3: "tajweed.madda_necessary",
  4: "tajweed.madda_normal",
  5: "tajweed.madda_normal",
  6: "tajweed.ghunnah",
  7: "tajweed.tafkhim",
  8: "tajweed.qalqalah",
  9: "tajweed.madda_permissible",
  15: "tajweed.silent",
};
