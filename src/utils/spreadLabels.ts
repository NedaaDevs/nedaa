// Nearest non-overlapping centres, by least squares: less the room each needs,
// the centres need only be non-decreasing, which pool-adjacent solves exactly.
export const spreadLabels = (
  xs: readonly number[],
  widths: readonly number[],
  total: number,
  space: number
): number[] => {
  const offsets = xs.map(() => 0);
  for (let i = 1; i < xs.length; i++) {
    offsets[i] = offsets[i - 1] + (widths[i - 1] + widths[i]) / 2 + space;
  }

  // Blocks of pooled targets, each holding its mean and size.
  const blocks: { mean: number; size: number }[] = [];
  xs.forEach((x, i) => {
    let block = { mean: x - offsets[i], size: 1 };
    while (blocks.length && blocks[blocks.length - 1].mean > block.mean) {
      const before = blocks.pop()!;
      const size = before.size + block.size;
      block = { mean: (before.mean * before.size + block.mean * block.size) / size, size };
    }
    blocks.push(block);
  });
  const shifted = blocks.flatMap((block) => Array<number>(block.size).fill(block.mean));

  const last = xs.length - 1;
  const low = widths[0] / 2;
  const high = total - widths[last] / 2 - offsets[last];
  // No room for every name: centre the packed row instead.
  const clip = (q: number) => (low > high ? (low + high) / 2 : Math.min(high, Math.max(low, q)));

  return shifted.map((q, i) => clip(q) + offsets[i]);
};
