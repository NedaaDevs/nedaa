import { timingRowState } from "@/utils/timingRows";
import { TimingRowState } from "@/enums/prayerTimes";

const ROW_COUNT = 5;
const states = (nextIndex: number) =>
  Array.from({ length: ROW_COUNT }, (_, i) => timingRowState(i, nextIndex));

describe("timingRowState", () => {
  it("splits the list around the next timing", () => {
    expect(states(2)).toEqual([
      TimingRowState.DONE,
      TimingRowState.DONE,
      TimingRowState.NEXT,
      TimingRowState.UPCOMING,
      TimingRowState.UPCOMING,
    ]);
  });

  it("marks nothing done when the first timing is next", () => {
    expect(states(0)).toEqual([
      TimingRowState.NEXT,
      TimingRowState.UPCOMING,
      TimingRowState.UPCOMING,
      TimingRowState.UPCOMING,
      TimingRowState.UPCOMING,
    ]);
  });

  // Past the last timing the next one belongs to tomorrow, so today reads as done
  // rather than highlighting tomorrow's Fajr at the top of today's list.
  it("marks the whole day done once the next timing rolls over to tomorrow", () => {
    expect(states(ROW_COUNT)).toEqual(Array(ROW_COUNT).fill(TimingRowState.DONE));
  });

  // -1 means "no next timing known" — nothing has passed, so nothing is dimmed.
  it("leaves every row upcoming when there is no next timing", () => {
    expect(states(-1)).toEqual(Array(ROW_COUNT).fill(TimingRowState.UPCOMING));
  });
});
