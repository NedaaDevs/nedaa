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
  SPREAD_CHROME_RATIO,
  FIT_WIDTH_CHROME_RATIO,
  MAX_SINGLE_PAGE_WIDTH,
  shouldDefaultSpread,
  MIN_SPREAD_PANE_WIDTH,
  canvasFrame,
  CanvasMode,
  SPREAD_GUTTER,
  SPREAD_TOP_PAD,
  SINGLE_FIT_ASPECT,
  fitSinglePageBox,
} from "@/utils/readerSpread";
import { SpreadPreference } from "@/enums/quran";
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

describe("shouldDefaultSpread (AUTO heuristics)", () => {
  it("is false on phones and in portrait", () => {
    expect(shouldDefaultSpread({ width: 844, height: 390 })).toBe(false);
    expect(shouldDefaultSpread({ width: 834, height: 1112 })).toBe(false);
  });
  it("each half-pane must reach MIN_SPREAD_PANE_WIDTH", () => {
    expect(MIN_SPREAD_PANE_WIDTH).toBe(580);
    // 13" iPad (1376×1024, 688/half) and 11" (1180×820, 590/half) spread…
    expect(shouldDefaultSpread({ width: 1376, height: 1024 })).toBe(true);
    expect(shouldDefaultSpread({ width: 1180, height: 820 })).toBe(true);
    // …iPad mini (1133×744, 566/half) stays single.
    expect(shouldDefaultSpread({ width: 1133, height: 744 })).toBe(false);
    // Exact boundary: width/2 >= 580.
    expect(shouldDefaultSpread({ width: 1160, height: 800 })).toBe(true);
    expect(shouldDefaultSpread({ width: 1159, height: 800 })).toBe(false);
  });
});

describe("resolveReaderLayout device matrix (tri-state preference)", () => {
  const layout = (w: number, h: number, pref: SpreadPreference = SpreadPreference.AUTO) =>
    resolveReaderLayout({ width: w, height: h, spreadPreference: pref });
  it("phone stays 'phone' in both orientations regardless of preference", () => {
    expect(layout(390, 844).mode).toBe(ReaderLayoutMode.PHONE);
    expect(layout(844, 390, SpreadPreference.ON).mode).toBe(ReaderLayoutMode.PHONE);
  });
  it("large portrait is always single", () => {
    expect(layout(834, 1112, SpreadPreference.ON).mode).toBe(ReaderLayoutMode.SINGLE);
  });
  it("AUTO follows shouldDefaultSpread", () => {
    expect(layout(1376, 1024).mode).toBe(ReaderLayoutMode.SPREAD);
    expect(layout(1133, 744).mode).toBe(ReaderLayoutMode.SINGLE);
  });
  it("explicit ON/OFF override geometry", () => {
    expect(layout(1133, 744, SpreadPreference.ON).mode).toBe(ReaderLayoutMode.SPREAD);
    expect(layout(1376, 1024, SpreadPreference.OFF).mode).toBe(ReaderLayoutMode.SINGLE);
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
  it("derives height from PAGE_ASPECT + percentage chrome so the page is taller than the viewport", () => {
    const box = fitWidthBox(1280); // a tablet's landscape width in dp
    const chrome = box.w * FIT_WIDTH_CHROME_RATIO;
    expect(box.h).toBe(Math.round(box.w * PAGE_ASPECT + chrome));
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
    const chrome = 800 * SPREAD_CHROME_RATIO;
    expect(box.w).toBe(Math.floor((800 - chrome) / PAGE_ASPECT));
    expect(box.w).toBeLessThan(1280);
  });
  it("uses the full slot width when height is generous (portrait)", () => {
    expect(fitPageBox(700, 2000).w).toBe(700);
  });
});

describe("fitSinglePageBox (tablet portrait: whole page, no scroll, dense pack)", () => {
  it("fits within the available height", () => {
    const box = fitSinglePageBox(900, 1024);
    expect(box.h).toBeLessThanOrEqual(1024);
  });
  it("packs denser than the ink-ratio fit, so the page is wider for the same height", () => {
    const availHeight = 1024;
    expect(fitSinglePageBox(2000, availHeight).w).toBeGreaterThan(
      fitPageBox(2000, availHeight).w
    );
  });
  it("never exceeds the slot width", () => {
    expect(fitSinglePageBox(600, 5000).w).toBeLessThanOrEqual(600);
  });
});

describe("canvasFrame (BookCanvas slab + crease share the pager's geometry)", () => {
  it("spread: one height-fit slab spans both panes plus the gutter; crease at center", () => {
    const availPageHeight = 1024 - SPREAD_TOP_PAD - 20;
    // Backdrop matches the panes' dense tablet pack, not the default aspect.
    const box = fitPageBox((1366 - SPREAD_GUTTER) / 2, availPageHeight, SINGLE_FIT_ASPECT);
    const frame = canvasFrame({
      mode: CanvasMode.SPREAD,
      width: 1366,
      screenHeight: 1024,
      availPageHeight,
    });
    expect(frame.slab).toEqual({
      x: Math.round((1366 - (box.w * 2 + SPREAD_GUTTER)) / 2),
      y: Math.round(SPREAD_TOP_PAD + (1024 - SPREAD_TOP_PAD - box.h) / 2),
      w: box.w * 2 + SPREAD_GUTTER,
      h: box.h,
    });
    expect(frame.creaseX).toBe(1366 / 2);
  });
  it("fit-width landscape: slab is the full-height page column (page scrolls under it)", () => {
    const box = fitWidthBox(1194);
    const frame = canvasFrame({
      mode: CanvasMode.FIT_WIDTH,
      width: 1194,
      screenHeight: 834,
      availPageHeight: 800,
    });
    expect(frame.slab).toEqual({ x: Math.round((1194 - box.w) / 2), y: 0, w: box.w, h: 834 });
    expect(frame.creaseX).toBeNull();
  });
});
