export type PairFit = {
  /** The width the two buttons share. */
  rowWidth: number;
  gap: number;
  /** A button's horizontal padding, on each side of its label. */
  inset: number;
  /** The labels' natural single-line widths. */
  labels: readonly [number, number];
};

/** True when each button, label and padding, fits in half the row. */
export const pairFits = ({ rowWidth, gap, inset, labels }: PairFit): boolean =>
  rowWidth > 0 && labels.every((label) => label + 2 * inset <= (rowWidth - gap) / 2);
