import { parseISO } from "date-fns";

import { DAY_RUN, DAY_RUN_KIND, DAY_RUN_MARGIN_MS, type DayRunKind } from "@/constants/DayRun";
import { PHASE } from "@/constants/Phase";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { RIYADH_DAY, riyadhAt } from "@/test-helpers/prayerDay";
import {
  dayRunClockAt,
  dayRunLengthMs,
  dayRunPhaseStartMs,
  dayRunSchedule,
  type DayRunSchedule,
} from "@/utils/dayRun";
import { ONE_DAY_MS, phaseAt, type StoredDays } from "@/utils/phase";
import { sampleDays } from "@/utils/sampleDays";

const PHASES = Object.values(PHASE);
const KINDS = Object.values(DAY_RUN_KIND);
const MINUTE_MS = 60_000;

const NOON = new Date(2026, 9, 28, 12);
const SAMPLE = sampleDays(NOON);
const RIYADH: StoredDays = { today: RIYADH_DAY };

const scheduleOf = (days: StoredDays, near: Date): DayRunSchedule => {
  const schedule = dayRunSchedule(days, near);
  if (!schedule) throw new Error("expected a schedule");
  return schedule;
};

const sample = scheduleOf(SAMPLE, NOON);
const preview = DAY_RUN[DAY_RUN_KIND.PREVIEW];
const debug = DAY_RUN[DAY_RUN_KIND.DEBUG];

/** The sample schedule's boundary times, in ms. */
const at = sample.boundaries.map((boundary) => boundary.getTime());

describe("dayRunSchedule", () => {
  it("runs from the margin before Fajr to the Fajr after the day", () => {
    const schedule = scheduleOf(RIYADH, parseISO(riyadhAt("03:00")));

    expect(schedule.boundaries).toEqual([
      parseISO(riyadhAt("04:03")),
      parseISO(riyadhAt("04:33")),
      parseISO(riyadhAt("05:50")),
      parseISO(riyadhAt("15:12")),
      parseISO(riyadhAt("17:40")),
      parseISO(riyadhAt("19:10")),
      new Date(parseISO(riyadhAt("04:33")).getTime() + ONE_DAY_MS),
    ]);
    expect(schedule.boundaries[0].getTime()).toBe(
      schedule.boundaries[1].getTime() - DAY_RUN_MARGIN_MS
    );
  });

  it("lists the phases in the order a day passes through them", () => {
    expect(sample.phases).toEqual(PHASES);
  });

  it("takes the next Fajr across the stored days", () => {
    const tomorrow = SAMPLE.tomorrow;
    if (!tomorrow) throw new Error("expected a tomorrow");
    const tomorrowTime = (iso: string) => parseISO(iso).getTime();

    expect(at.slice(1, 6)).toEqual([
      tomorrowTime(tomorrow.timings[PRAYER_ID.FAJR]),
      tomorrowTime(tomorrow.otherTimings[OTHER_TIMING.SUNRISE]),
      tomorrowTime(tomorrow.timings[PRAYER_ID.ASR]),
      tomorrowTime(tomorrow.timings[PRAYER_ID.MAGHRIB]),
      tomorrowTime(tomorrow.timings[PRAYER_ID.ISHA]),
    ]);
    expect(at[6]).toBe(at[1] + ONE_DAY_MS);
  });

  it("takes a Fajr strictly after `near`", () => {
    const today = SAMPLE.today;
    if (!today) throw new Error("expected a today");
    const fajr = parseISO(today.timings[PRAYER_ID.FAJR]);

    expect(scheduleOf(SAMPLE, fajr).boundaries[1].getTime()).toBe(at[1]);
    expect(scheduleOf(SAMPLE, new Date(fajr.getTime() - 1)).boundaries[1]).toEqual(fajr);
  });

  it("is null when the days hold no Fajr", () => {
    expect(dayRunSchedule({}, NOON)).toBeNull();
    expect(dayRunSchedule({ today: null }, NOON)).toBeNull();
  });

  it("is null when the days stop before the day after the next Fajr is whole", () => {
    expect(dayRunSchedule(RIYADH, parseISO(riyadhAt("20:00")))).toBeNull();
  });
});

describe("a PREVIEW run", () => {
  const kind = DAY_RUN_KIND.PREVIEW;

  it("takes the prelude plus the same time for each phase", () => {
    expect(dayRunLengthMs(sample, kind)).toBe(preview.preludeMs + PHASES.length * preview.phaseMs);
  });

  it("reaches each boundary after the prelude and every phase before it", () => {
    sample.boundaries.slice(1).forEach((boundary, index) => {
      const elapsed = preview.preludeMs + index * preview.phaseMs;
      expect(dayRunClockAt(sample, kind, elapsed)).toEqual(boundary);
    });
  });

  it("starts at the margin and crosses it in the prelude", () => {
    expect(dayRunClockAt(sample, kind, 0)).toEqual(sample.boundaries[0]);
    expect(dayRunClockAt(sample, kind, preview.preludeMs / 2).getTime()).toBe(
      at[0] + (at[1] - at[0]) / 2
    );
  });

  it("moves linearly inside a phase, whatever its length on the clock", () => {
    PHASES.forEach((_, index) => {
      const start = at[index + 1];
      const end = at[index + 2];
      const elapsed = preview.preludeMs + index * preview.phaseMs;

      expect(dayRunClockAt(sample, kind, elapsed + preview.phaseMs / 4).getTime()).toBe(
        start + (end - start) / 4
      );
      expect(dayRunClockAt(sample, kind, elapsed + preview.phaseMs / 2).getTime()).toBe(
        start + (end - start) / 2
      );
    });
  });

  it("holds at the ends when the elapsed time falls outside the run", () => {
    expect(dayRunClockAt(sample, kind, -1)).toEqual(sample.boundaries[0]);
    expect(dayRunClockAt(sample, kind, dayRunLengthMs(sample, kind) + 1)).toEqual(
      sample.boundaries[6]
    );
  });

  it("starts each phase after the prelude and the phases before it", () => {
    expect(dayRunPhaseStartMs(sample, kind, PHASE.DAWN)).toBe(preview.preludeMs);
    expect(dayRunPhaseStartMs(sample, kind, PHASE.MAGHRIB)).toBe(
      preview.preludeMs + 3 * preview.phaseMs
    );
  });
});

describe("a DEBUG run", () => {
  const kind = DAY_RUN_KIND.DEBUG;

  it("takes one tick for each step of clock time", () => {
    const span = at[6] - at[0];

    expect(dayRunLengthMs(sample, kind)).toBe((span / debug.stepMs) * debug.tickMs);
  });

  it("moves one step of clock time in each tick", () => {
    expect(dayRunClockAt(sample, kind, 0)).toEqual(sample.boundaries[0]);
    expect(dayRunClockAt(sample, kind, debug.tickMs).getTime()).toBe(at[0] + debug.stepMs);
    expect(dayRunClockAt(sample, kind, 6 * debug.tickMs).getTime()).toBe(at[0] + 30 * MINUTE_MS);
  });

  it("holds at the ends when the elapsed time falls outside the run", () => {
    expect(dayRunClockAt(sample, kind, -1)).toEqual(sample.boundaries[0]);
    expect(dayRunClockAt(sample, kind, dayRunLengthMs(sample, kind) + 1)).toEqual(
      sample.boundaries[6]
    );
  });

  it("starts a phase when the clock reaches its time", () => {
    expect(dayRunPhaseStartMs(sample, kind, PHASE.MAGHRIB)).toBe(
      ((at[4] - at[0]) / debug.stepMs) * debug.tickMs
    );
  });
});

describe.each<DayRunKind>(KINDS)("a %s run over a phase that takes no clock time", (kind) => {
  const flat: DayRunSchedule = {
    ...sample,
    boundaries: sample.boundaries.map((boundary, index) =>
      index === 6 ? sample.boundaries[5] : boundary
    ),
  };

  it("still gives a valid clock at every time", () => {
    const length = dayRunLengthMs(flat, kind);

    [0, length / 3, length / 2, length].forEach((elapsed) => {
      expect(Number.isNaN(dayRunClockAt(flat, kind, elapsed).getTime())).toBe(false);
    });
    expect(dayRunClockAt(flat, kind, length)).toEqual(flat.boundaries[6]);
  });
});

describe.each<DayRunKind>(KINDS)("a %s run", (kind) => {
  it("agrees with phaseAt: each phase start puts the clock in that phase", () => {
    PHASES.forEach((phase, index) => {
      const clock = dayRunClockAt(sample, kind, dayRunPhaseStartMs(sample, kind, phase));

      expect(clock).toEqual(sample.boundaries[index + 1]);
      expect(phaseAt(clock, SAMPLE)).toBe(phase);
    });
  });

  it("starts the phases in order, inside the run", () => {
    const starts = PHASES.map((phase) => dayRunPhaseStartMs(sample, kind, phase));

    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(starts[0]).toBeGreaterThan(0);
    expect(starts[starts.length - 1]).toBeLessThan(dayRunLengthMs(sample, kind));
  });
});
