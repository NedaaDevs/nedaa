import {
  IMAGE_SOURCE_LINE_HEIGHT,
  IMAGE_SOURCE_WIDTH,
  LINES_PER_PAGE,
  TOTAL_PAGES,
} from "@/constants/Quran";

// A "large" device is one whose shortest side reaches the sw600dp tablet
// breakpoint. Using the live window means fold/unfold and Split View just work.
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

export const resolveReaderLayout = (args: {
  width: number;
  height: number;
  spreadEnabled: boolean;
}): ReaderLayout => {
  const { width, height, spreadEnabled } = args;
  const isLarge = Math.min(width, height) >= LARGE_DEVICE_MIN_DP;
  const isLandscape = width > height;
  const mode: ReaderLayoutMode = !isLarge
    ? ReaderLayoutMode.PHONE
    : isLandscape && spreadEnabled
      ? ReaderLayoutMode.SPREAD
      : ReaderLayoutMode.SINGLE;
  return { mode, isLarge, isLandscape };
};

// --- Large-device page sizing (pure; no RN deps so it's unit-testable) ---

// Fraction of each 1440×232 line strip kept when packing lines (strips carry
// ~19% transparent padding, so ink fills ~81% of the height). Lower = tighter.
export const LINE_INK_RATIO = 0.81;
// A page's height:width ratio — 15 ink-packed lines over the source width.
// Large-device pages preserve this; they're never stretched to the screen.
export const PAGE_ASPECT =
  (IMAGE_SOURCE_LINE_HEIGHT * LINES_PER_PAGE * LINE_INK_RATIO) / IMAGE_SOURCE_WIDTH;
// Running header (surah/juz) + page-number height added to the page box so the
// line area keeps the true ratio.
export const LARGE_PAGE_CHROME = 80;
// Width cap so a fit-to-width page doesn't over-zoom on very wide screens —
// a page is sized to min(this, 0.97×slot width).
export const MAX_SINGLE_PAGE_WIDTH = 1080;

export interface PageBox {
  w: number;
  h: number;
}

// Largest undistorted page that fits a slot constrained by BOTH its width and the
// available height — the whole page is visible (portrait single, spread halves).
export const fitPageBox = (slotWidth: number, availHeight: number): PageBox => {
  const w = Math.min(slotWidth, Math.floor((availHeight - LARGE_PAGE_CHROME) / PAGE_ASPECT));
  return { w, h: Math.round(w * PAGE_ASPECT + LARGE_PAGE_CHROME) };
};

// Page sized to the slot WIDTH (capped); height follows the aspect and may exceed
// the screen — the caller scrolls it vertically (large landscape single page).
export const fitWidthBox = (slotWidth: number): PageBox => {
  const w = Math.min(MAX_SINGLE_PAGE_WIDTH, Math.floor(slotWidth * 0.97));
  return { w, h: Math.round(w * PAGE_ASPECT + LARGE_PAGE_CHROME) };
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
