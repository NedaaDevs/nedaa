import { FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from "@/constants/Quran";

// Reading measure in em. 22em lands near 40–50 Arabic characters, the line
// length low-vision reading guidance calls for.
export const READER_MEASURE_EM = 22;

// Font size for a pinch of `scale` against the size the pinch started from,
// snapped to the same step the +/− buttons use and clamped to the range. A
// non-finite scale (a gesture with no movement yet) leaves the size alone.
export const pinchFontSize = (baseSize: number, scale: number): number => {
  if (!Number.isFinite(scale)) return baseSize;
  const stepped = Math.round((baseSize * scale) / FONT_SIZE_STEP) * FONT_SIZE_STEP;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, stepped));
};

// Column width for the reading font size, never wider than its container. A
// non-positive font size (first paint) falls back to the container.
export const readerColumnWidth = (fontSize: number, containerWidth: number): number => {
  if (fontSize <= 0) return containerWidth;
  return Math.min(fontSize * READER_MEASURE_EM, containerWidth);
};
