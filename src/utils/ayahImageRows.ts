import { IMAGE_SOURCE_WIDTH } from "@/constants/Quran";
import type { GlyphBound } from "@/types/quran";

/** A slice of one line image, in source pixels. */
export type AyahRun = { line: number; x: number; width: number };

/** Source pixels kept clear of the ink where no word of the ayah follows. */
export const AYAH_EDGE_PAD = 6;

/** A word with the space to the next word of the ayah on its line. */
type Word = AyahRun & { right: number };

const wordsOf = (bounds: readonly GlyphBound[], surah: number, ayah: number): Word[] => {
  const glyphs = bounds
    .filter((g) => g.surahNumber === surah && g.ayahNumber === ayah && !g.isMarker)
    .sort((a, b) => a.line - b.line || a.position - b.position);

  // A line reads from the right, so the word before sits to the right.
  return glyphs.map((glyph, i) => {
    const before = glyphs[i - 1];
    const after = glyphs[i + 1];
    const inkRight = glyph.x + glyph.width;
    const right =
      before?.line === glyph.line
        ? Math.min(inkRight, before.x)
        : Math.min(IMAGE_SOURCE_WIDTH, inkRight + AYAH_EDGE_PAD);
    const x =
      after?.line === glyph.line
        ? Math.min(glyph.x, after.x + after.width)
        : Math.max(0, glyph.x - AYAH_EDGE_PAD);
    return { line: glyph.line, x, width: right - x, right };
  });
};

/** Fills each row in reading order; a wider word takes a row alone. */
const fill = (words: readonly Word[], rowWidth: number): Word[][] => {
  const rows: Word[][] = [];
  let used = 0;
  for (const word of words) {
    const row = rows.at(-1);
    if (row && used + word.width <= rowWidth) {
      row.push(word);
      used += word.width;
    } else {
      rows.push([word]);
      used = word.width;
    }
  }
  return rows;
};

/** Joins the words of a row that sit side by side on one line image. */
const toRuns = (row: readonly Word[]): AyahRun[] => {
  const runs: AyahRun[] = [];
  for (const { line, x, width, right } of row) {
    const last = runs.at(-1);
    if (last && last.line === line && last.x === right) {
      last.x = x;
      last.width += width;
    } else {
      runs.push({ line, x, width });
    }
  }
  return runs;
};

/** The ayah as rows of line-image slices, each at most `rowWidth` wide. */
export const ayahImageRows = (
  bounds: readonly GlyphBound[],
  surah: number,
  ayah: number,
  rowWidth: number
): AyahRun[][] => {
  const words = wordsOf(bounds, surah, ayah);
  if (words.length === 0) return [];

  // Evened out: the narrowest width that needs no extra row.
  const rowCount = fill(words, rowWidth).length;
  let low = Math.max(...words.map((word) => word.width));
  const total = words.reduce((sum, word) => sum + word.width, 0);
  let high = Math.max(low, Math.min(rowWidth, total));
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (fill(words, mid).length > rowCount) low = mid + 1;
    else high = mid;
  }
  return fill(words, high).map(toRuns);
};
