import { TimingRowState } from "@/enums/prayerTimes";

/**
 * Places a row relative to the next timing.
 *
 * `nextIndex` of -1 means "nothing is marked next", so no row is treated as
 * past; a value at or beyond the row count means the whole list has passed.
 */
export const timingRowState = (index: number, nextIndex: number): TimingRowState => {
  if (nextIndex < 0) return TimingRowState.UPCOMING;
  if (index < nextIndex) return TimingRowState.DONE;
  if (index === nextIndex) return TimingRowState.NEXT;
  return TimingRowState.UPCOMING;
};
