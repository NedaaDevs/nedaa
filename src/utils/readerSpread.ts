import { TOTAL_PAGES } from "@/constants/Quran";

// A "large" device is one whose shortest side reaches the sw600dp tablet
// breakpoint. Using the live window means fold/unfold and Split View just work.
export const LARGE_DEVICE_MIN_DP = 600;

export type ReaderLayoutMode = "phone" | "single" | "spread";

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
    ? "phone"
    : isLandscape && spreadEnabled
      ? "spread"
      : "single";
  return { mode, isLarge, isLandscape };
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
