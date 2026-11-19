import { IMAGE_SOURCE_WIDTH } from "@/constants/Quran";
import type { GlyphBound } from "@/types/quran";
import { AYAH_EDGE_PAD, type AyahRun, ayahImageRows } from "@/utils/ayahImageRows";

const SURAH = 2;
const AYAH = 8;
const PAGE = 3;

type Box = [line: number, position: number, x: number, width: number, marker?: boolean];

const glyph = ([line, position, x, width, marker = false]: Box, ayah = AYAH): GlyphBound => ({
  page: PAGE,
  line,
  position,
  surahNumber: SURAH,
  ayahNumber: ayah,
  wordIndex: position,
  x,
  y: 60,
  width,
  height: 100,
  isMarker: marker,
});

/** Al-Baqarah 8 in v2: two words end line 3, the rest fill line 4. */
const BAQARAH_8: Box[] = [
  [3, 6, 248, 108],
  [3, 7, 55, 193],
  [4, 1, 1318, 74],
  [4, 2, 1172, 147],
  [4, 3, 1042, 130],
  [4, 4, 924, 118],
  [4, 5, 732, 192],
  [4, 6, 548, 183],
  [4, 7, 462, 86],
  [4, 8, 365, 98],
  [4, 9, 116, 248],
  [4, 9, 47, 69, true],
];
/** The words before it on line 3, and the marker between. */
const NEIGHBOURS: GlyphBound[] = [glyph([3, 5, 441, 224], 7), glyph([3, 5, 356, 84, true], 7)];
const BOUNDS = [...NEIGHBOURS, ...BAQARAH_8.map((box) => glyph(box))];

const rowsFor = (rowWidth: number, bounds = BOUNDS) => ayahImageRows(bounds, SURAH, AYAH, rowWidth);
const widthOf = (row: AyahRun[]) => row.reduce((sum, run) => sum + run.width, 0);
const right = (run: AyahRun) => run.x + run.width;

/** Five words of 100, side by side on one line. */
const EVEN_WORDS = [0, 1, 2, 3, 4].map((i) => glyph([1, i + 1, 1000 - i * 100, 100]));

describe("ayahImageRows", () => {
  it("lays an ayah out in one row when the row has no limit", () => {
    expect(rowsFor(Number.POSITIVE_INFINITY)).toHaveLength(1);
  });

  it("returns nothing for an ayah with no words on the page", () => {
    expect(ayahImageRows(BOUNDS, SURAH, 99, 1000)).toEqual([]);
  });

  it("joins the ayah's lines into one row when they fit", () => {
    const [row, ...rest] = rowsFor(IMAGE_SOURCE_WIDTH * 2);

    expect(rest).toEqual([]);
    expect(row.map((run) => run.line)).toEqual([3, 4]);
  });

  it("starts each run a margin before the ink and ends it a margin after", () => {
    const [[first, second]] = rowsFor(IMAGE_SOURCE_WIDTH * 2);

    expect(right(first)).toBe(356 + AYAH_EDGE_PAD);
    expect(first.x).toBe(55 - AYAH_EDGE_PAD);
    expect(right(second)).toBe(1392 + AYAH_EDGE_PAD);
  });

  it("leaves the marker's box out", () => {
    const [[, second]] = rowsFor(IMAGE_SOURCE_WIDTH * 2);

    expect(second.x).toBe(116 - AYAH_EDGE_PAD);
  });

  it("keeps a margin inside the image", () => {
    const edge = [glyph([1, 1, IMAGE_SOURCE_WIDTH - 50, 50]), glyph([1, 2, 0, 80])];
    const [[run]] = rowsFor(IMAGE_SOURCE_WIDTH * 2, edge);

    expect(run.x).toBe(0);
    expect(right(run)).toBe(IMAGE_SOURCE_WIDTH);
  });

  it.each([400, 700, 1000])("fits every row in %i and keeps every word whole", (rowWidth) => {
    const rows = rowsFor(rowWidth);

    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(widthOf(row)).toBeLessThanOrEqual(rowWidth);
    // Each run ends where a word ends, so no word is cut by a row break.
    const wordEdges = new Set(BAQARAH_8.flatMap(([, , x, width]) => [x, x + width]));
    const inner = rows.flat().flatMap((run) => [run.x, right(run)]);
    for (const edge of inner) {
      const atWord = wordEdges.has(edge);
      const atMargin = wordEdges.has(edge + AYAH_EDGE_PAD) || wordEdges.has(edge - AYAH_EDGE_PAD);
      expect(atWord || atMargin).toBe(true);
    }
  });

  it("covers every word once, in reading order", () => {
    const rows = rowsFor(500);
    // Neighbouring ink boxes overlap by a pixel at most.
    const covered = ([line, , x, width]: Box) =>
      rows
        .flat()
        .filter((run) => run.line === line && run.x <= x + 1 && right(run) >= x + width - 1);

    for (const box of BAQARAH_8.filter(([, , , , marker]) => !marker)) {
      expect(covered(box)).toHaveLength(1);
    }
    const order = rows.flat().map((run) => `${run.line}:${String(9999 - run.x).padStart(4, "0")}`);
    expect(order).toEqual([...order].sort());
  });

  it("evens the rows out and leaves no short last row", () => {
    const rows = rowsFor(4 * 100 + 2 * AYAH_EDGE_PAD + 50, EVEN_WORDS);

    expect(rows.map((row) => Math.round(widthOf(row) / 100))).toEqual([3, 2]);
  });

  it("gives a word wider than the row a row of its own", () => {
    const rows = rowsFor(150);

    expect(rows.flat().some((run) => run.width > 150)).toBe(true);
    for (const row of rows) if (widthOf(row) > 150) expect(row).toHaveLength(1);
  });
});
