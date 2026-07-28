// Reading measure in em. 22em lands near 40–50 Arabic characters, the line
// length low-vision reading guidance calls for.
export const READER_MEASURE_EM = 22;

// Column width for the reading font size, never wider than its container. A
// non-positive font size (first paint) falls back to the container.
export const readerColumnWidth = (fontSize: number, containerWidth: number): number => {
  if (fontSize <= 0) return containerWidth;
  return Math.min(fontSize * READER_MEASURE_EM, containerWidth);
};
