import {
  IMAGE_SOURCE_LINE_HEIGHT,
  IMAGE_SOURCE_WIDTH,
  LINES_PER_PAGE,
  TOTAL_PAGES,
} from "@/constants/Quran";
import { SpreadPreference } from "@/enums/quran";

// A "large" device: shortest side reaches the sw600dp tablet breakpoint.
export const LARGE_DEVICE_MIN_DP = 600;

export const ReaderLayoutMode = {
  PHONE: "phone",
  SINGLE: "single",
  SPREAD: "spread",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type ReaderLayoutMode = (typeof ReaderLayoutMode)[keyof typeof ReaderLayoutMode];

export interface ReaderLayout {
  mode: ReaderLayoutMode;
  isLarge: boolean;
  isLandscape: boolean;
}

// AUTO spread floor: 13" (688) and 11" (590) iPads pass; mini (566) and
// 10.2" (540) stay single.
export const MIN_SPREAD_PANE_WIDTH = 580;

// AUTO opens as a spread: large landscape with wide-enough halves.
export const shouldDefaultSpread = (args: { width: number; height: number }): boolean => {
  const { width, height } = args;
  const isLarge = Math.min(width, height) >= LARGE_DEVICE_MIN_DP;
  if (!isLarge || width <= height) return false;
  return width / 2 >= MIN_SPREAD_PANE_WIDTH;
};

export const resolveReaderLayout = (args: {
  width: number;
  height: number;
  spreadPreference: SpreadPreference;
}): ReaderLayout => {
  const { width, height, spreadPreference } = args;
  const isLarge = Math.min(width, height) >= LARGE_DEVICE_MIN_DP;
  const isLandscape = width > height;
  const spreadOn =
    spreadPreference === SpreadPreference.ON ||
    (spreadPreference === SpreadPreference.AUTO && shouldDefaultSpread({ width, height }));
  const mode: ReaderLayoutMode = !isLarge
    ? ReaderLayoutMode.PHONE
    : isLandscape && spreadOn
      ? ReaderLayoutMode.SPREAD
      : ReaderLayoutMode.SINGLE;
  return { mode, isLarge, isLandscape };
};

// --- Large-device page sizing (pure; no RN deps so it's unit-testable) ---

// Ink fraction of each 1440×232 line strip (~24% is transparent padding);
// packing to ink keeps the aspect of a printed mushaf.
export const LINE_INK_RATIO = 0.76;
// Page height:width — 15 ink-packed lines over the source width; never stretched.
export const PAGE_ASPECT =
  (IMAGE_SOURCE_LINE_HEIGHT * LINES_PER_PAGE * LINE_INK_RATIO) / IMAGE_SOURCE_WIDTH;
// Header/page-number space reserved as a percentage — a flat px value would
// over-pad small tablets and under-pad large ones.
export const SPREAD_CHROME_RATIO = 0.03; // 3% of availHeight (top + bottom gutters)
export const FIT_WIDTH_CHROME_RATIO = 0.04; // 4% of the layout page width
// Width cap so a fit-to-width page doesn't over-zoom very wide screens.
export const MAX_SINGLE_PAGE_WIDTH = 1080;

export interface PageBox {
  w: number;
  h: number;
}

// Largest undistorted page fitting slot width AND available height —
// WHOLE-fit spread panes (entire 15-line page visible).
export const fitPageBox = (slotWidth: number, availHeight: number): PageBox => {
  const chrome = availHeight * SPREAD_CHROME_RATIO;
  const w = Math.min(slotWidth, Math.floor((availHeight - chrome) / PAGE_ASPECT));
  return { w, h: Math.round(w * PAGE_ASPECT + chrome) };
};

// Page sized to the slot width (capped); taller than the screen, the caller scrolls.
export const fitWidthBox = (slotWidth: number): PageBox => {
  const w = Math.min(MAX_SINGLE_PAGE_WIDTH, Math.floor(slotWidth * 0.97));
  const chrome = w * FIT_WIDTH_CHROME_RATIO;
  return { w, h: Math.round(w * PAGE_ASPECT + chrome) };
};

// One SCROLL-fit spread pane: half the gutter-adjusted width (capped); scrolls alone.
export const fitSpreadWidthBox = (width: number): PageBox => {
  const w = Math.min(MAX_SINGLE_PAGE_WIDTH, Math.floor(((width - SPREAD_GUTTER) / 2) * 0.97));
  const chrome = w * FIT_WIDTH_CHROME_RATIO;
  return { w, h: Math.round(w * PAGE_ASPECT + chrome) };
};

// Spine gap and top breathing room (minimal — reserved dp shrinks the pages).
export const SPREAD_GUTTER = 10;
export const SPREAD_TOP_PAD = 8;

// BookCanvas placement mode — mirrors the reader's large-device layouts.
export const CanvasMode = {
  SPREAD: "spread",
  SPREAD_SCROLL: "spread-scroll",
  FIT_WIDTH: "fit-width",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type CanvasMode = (typeof CanvasMode)[keyof typeof CanvasMode];

export interface CanvasFrame {
  // "Book slab" rect (screen coords): shadow + page-edge hint; spans a whole spread.
  slab: { x: number; y: number; w: number; h: number };
  // x of the spine crease center; null when there is no spread.
  creaseX: number | null;
}

// Where the BookCanvas paints, derived from the SAME fit functions the pager
// uses — a second geometry source would let the shadow drift off the page.
export const canvasFrame = (args: {
  mode: CanvasMode;
  width: number;
  screenHeight: number;
  availPageHeight: number;
}): CanvasFrame => {
  const { mode, width, screenHeight, availPageHeight } = args;
  // Vertical centering of a spread row: content centers below SPREAD_TOP_PAD.
  const spreadY = (h: number) =>
    Math.round(SPREAD_TOP_PAD + (screenHeight - SPREAD_TOP_PAD - h) / 2);
  switch (mode) {
    case CanvasMode.SPREAD: {
      // WHOLE fit: fully visible pair; height margins become book margins.
      const box = fitPageBox((width - SPREAD_GUTTER) / 2, availPageHeight);
      const w = box.w * 2 + SPREAD_GUTTER;
      return {
        slab: { x: Math.round((width - w) / 2), y: spreadY(box.h), w, h: box.h },
        creaseX: width / 2,
      };
    }
    case CanvasMode.SPREAD_SCROLL: {
      // SCROLL-fit pair: panes scroll under a full-height slab column.
      const box = fitSpreadWidthBox(width);
      const w = box.w * 2 + SPREAD_GUTTER;
      return {
        slab: { x: Math.round((width - w) / 2), y: 0, w, h: screenHeight },
        creaseX: width / 2,
      };
    }
    case CanvasMode.FIT_WIDTH: {
      const box = fitWidthBox(width);
      return {
        slab: { x: Math.round((width - box.w) / 2), y: 0, w: box.w, h: screenHeight },
        creaseX: null,
      };
    }
  }
};

// Coerce to a valid page (1..TOTAL_PAGES) — out-of-range would blank the reader.
export const clampPage = (page: number): number => {
  if (!Number.isFinite(page)) return 1;
  return Math.min(TOTAL_PAGES, Math.max(1, Math.round(page)));
};

// RTL pairing: spread N shows the odd (earlier, right) page and the even
// (later, left) page. (1,2),(3,4)... — 604 is even, so no orphan page.
export const TOTAL_SPREADS = Math.ceil(TOTAL_PAGES / 2);
export const spreadOf = (page: number): number => Math.ceil(page / 2);
export const anchorPage = (page: number): number => spreadOf(page) * 2 - 1;
export const pagesOfSpread = (spread: number): number[] => {
  const right = spread * 2 - 1;
  const left = right + 1;
  return left > TOTAL_PAGES ? [right] : [right, left];
};
