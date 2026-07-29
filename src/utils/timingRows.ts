import { TimingRowState } from "@/enums/prayerTimes";

// -1 means nothing is next, so nothing reads as past; a value at or beyond the
// row count means the whole day has passed.
export const timingRowState = (index: number, nextIndex: number): TimingRowState => {
  if (nextIndex < 0) return TimingRowState.UPCOMING;
  if (index < nextIndex) return TimingRowState.DONE;
  if (index === nextIndex) return TimingRowState.NEXT;
  return TimingRowState.UPCOMING;
};
