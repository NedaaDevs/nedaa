import {
  resolveReaderLayout,
  spreadOf,
  pagesOfSpread,
  anchorPage,
  clampPage,
  TOTAL_SPREADS,
  LARGE_DEVICE_MIN_DP,
  ReaderLayoutMode,
  fitPageBox,
  fitWidthBox,
  PAGE_ASPECT,
  LARGE_PAGE_CHROME,
  MAX_SINGLE_PAGE_WIDTH,
} from "@/utils/readerSpread";
import { TOTAL_PAGES } from "@/constants/Quran";

describe("page <-> spread mapping (RTL: right=earlier/odd, left=later/even)", () => {
  it("pairs (1,2),(3,4)...; odd page anchors its spread", () => {
    expect(spreadOf(1)).toBe(1);
    expect(spreadOf(2)).toBe(1);
    expect(spreadOf(3)).toBe(2);
    expect(spreadOf(604)).toBe(302);
    expect(TOTAL_SPREADS).toBe(302);
  });
  it("pagesOfSpread returns [right/earlier, left/later]", () => {
    expect(pagesOfSpread(1)).toEqual([1, 2]);
    expect(pagesOfSpread(302)).toEqual([603, 604]);
  });
  it("anchorPage is the spread's right/earlier (odd) page", () => {
    expect(anchorPage(3)).toBe(3);
    expect(anchorPage(4)).toBe(3);
    expect(anchorPage(1)).toBe(1);
  });
});

describe("resolveReaderLayout device matrix", () => {
  const layout = (w: number, h: number, spreadEnabled = true) =>
    resolveReaderLayout({ width: w, height: h, spreadEnabled });
  it("phone stays 'phone' in both orientations", () => {
    expect(layout(390, 844).mode).toBe(ReaderLayoutMode.PHONE);
    expect(layout(844, 390).mode).toBe(ReaderLayoutMode.PHONE);
  });
  it("large portrait => single; large landscape => spread", () => {
    expect(layout(834, 1112).mode).toBe(ReaderLayoutMode.SINGLE);
    expect(layout(1194, 834).mode).toBe(ReaderLayoutMode.SPREAD);
  });
  it("large landscape with spread disabled => single", () => {
    expect(layout(1194, 834, false).mode).toBe(ReaderLayoutMode.SINGLE);
  });
  it("threshold is shortest-side >= LARGE_DEVICE_MIN_DP", () => {
    expect(LARGE_DEVICE_MIN_DP).toBe(600);
    expect(layout(599, 900).mode).toBe(ReaderLayoutMode.PHONE);
    expect(layout(600, 900).mode).toBe(ReaderLayoutMode.SINGLE);
  });
});

describe("fitWidthBox (large landscape: fit to width, scroll vertically)", () => {
  it("sizes the page to ~97% of the slot width on a normal large screen", () => {
    expect(fitWidthBox(1000).w).toBe(970);
  });
  it("caps width at MAX_SINGLE_PAGE_WIDTH on very wide screens", () => {
    expect(fitWidthBox(1600).w).toBe(MAX_SINGLE_PAGE_WIDTH);
  });
  it("derives height from PAGE_ASPECT so the page is taller than a landscape viewport (scrolls)", () => {
    const box = fitWidthBox(1280); // a tablet's landscape width in dp
    expect(box.h).toBe(Math.round(box.w * PAGE_ASPECT + LARGE_PAGE_CHROME));
    expect(box.h).toBeGreaterThan(800); // taller than the ~800dp landscape height
  });
});

describe("clampPage (guards the reader against a blank page window)", () => {
  it("passes valid pages through unchanged", () => {
    expect(clampPage(1)).toBe(1);
    expect(clampPage(300)).toBe(300);
    expect(clampPage(TOTAL_PAGES)).toBe(TOTAL_PAGES);
  });
  it("clamps out-of-range pages into 1..TOTAL_PAGES", () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-5)).toBe(1);
    expect(clampPage(TOTAL_PAGES + 10)).toBe(TOTAL_PAGES);
  });
  it("rounds fractional pages to the nearest integer", () => {
    expect(clampPage(12.4)).toBe(12);
    expect(clampPage(12.6)).toBe(13);
  });
  it("falls back to page 1 for non-finite values", () => {
    expect(clampPage(NaN)).toBe(1);
    expect(clampPage(Infinity)).toBe(1);
    expect(clampPage(-Infinity)).toBe(1);
    // A NaN persisted as JSON round-trips to null; guard null/undefined too.
    expect(clampPage(null as unknown as number)).toBe(1);
    expect(clampPage(undefined as unknown as number)).toBe(1);
  });
});

describe("fitPageBox (portrait/spread: whole page visible, height-constrained)", () => {
  it("constrains width by the available height on a short landscape screen", () => {
    const box = fitPageBox(1280, 800);
    expect(box.w).toBe(Math.floor((800 - LARGE_PAGE_CHROME) / PAGE_ASPECT));
    expect(box.w).toBeLessThan(1280);
  });
  it("uses the full slot width when height is generous (portrait)", () => {
    expect(fitPageBox(700, 2000).w).toBe(700);
  });
});
