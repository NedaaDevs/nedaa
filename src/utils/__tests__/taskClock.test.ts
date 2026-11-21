import {
  QUIET_BAR_STEP_SECONDS,
  QUIET_ENDING_SECONDS,
  QUIET_PHASE,
  QUIET_TIME_SECONDS,
  TASK_CLOCK_MAX_GAIN_MS,
  TASK_CLOCK_TICK_MS,
  WAY_OUT_SOUNDING_SECONDS,
} from "@/constants/WakeTaskShell";
import i18n from "@/localization/i18n";
import {
  advanceTaskClock,
  endQuiet,
  quietFraction,
  quietPhase,
  quietSecondsFor,
  quietSecondsLeft,
  restartQuiet,
  resumeTaskClock,
  startTaskClock,
  wayOutSentence,
  wayOutShown,
  type TaskClock,
} from "@/utils/taskClock";

const OPENED = 1_000_000;
const QUIET_MS = 30_000;
const SECOND = 1000;

/** The clock read at each tick after `from`, up to `to`. */
const tick = (start: TaskClock, from: number, to: number, audible = true) => {
  let clock = start;
  for (let now = from + TASK_CLOCK_TICK_MS; now <= to; now += TASK_CLOCK_TICK_MS) {
    clock = advanceTaskClock(clock, now, audible);
  }
  return clock;
};

/** The clock after running from opening to `at`, read at each tick. */
const runTo = (at: number, audible = true) =>
  tick(startTaskClock(OPENED, QUIET_MS), OPENED, at, audible);

describe("taskClock", () => {
  describe("quiet phase", () => {
    it("is paused until the last seconds of quiet time", () => {
      const clock = startTaskClock(OPENED, QUIET_MS);
      const endingFrom = OPENED + QUIET_MS - QUIET_ENDING_SECONDS * SECOND;

      expect(quietPhase(clock, OPENED)).toBe(QUIET_PHASE.PAUSED);
      expect(quietPhase(clock, endingFrom - 1)).toBe(QUIET_PHASE.PAUSED);
      expect(quietPhase(clock, endingFrom)).toBe(QUIET_PHASE.ENDING);
      expect(quietPhase(clock, OPENED + QUIET_MS - 1)).toBe(QUIET_PHASE.ENDING);
      expect(quietPhase(clock, OPENED + QUIET_MS)).toBe(QUIET_PHASE.SOUNDING);
    });

    it("pauses again at full length when quiet restarts", () => {
      const later = OPENED + QUIET_MS + 7 * SECOND;
      const clock = restartQuiet(runTo(later), later, QUIET_MS, true);

      expect(quietPhase(clock, later)).toBe(QUIET_PHASE.PAUSED);
      expect(quietSecondsLeft(clock, later)).toBe(QUIET_MS / SECOND);
    });

    it("rounds the seconds left up, and never below zero", () => {
      const clock = startTaskClock(OPENED, QUIET_MS);

      expect(quietSecondsLeft(clock, OPENED + 1)).toBe(QUIET_MS / SECOND);
      expect(quietSecondsLeft(clock, OPENED + QUIET_MS - 1)).toBe(1);
      expect(quietSecondsLeft(clock, OPENED + QUIET_MS + SECOND)).toBe(0);
    });
  });

  describe("sounding time", () => {
    it("counts nothing while quiet", () => {
      expect(runTo(OPENED + QUIET_MS).soundingMs).toBe(0);
    });

    it("counts each second the alarm sounds after quiet ends", () => {
      expect(runTo(OPENED + QUIET_MS + 9 * SECOND).soundingMs).toBe(9 * SECOND);
    });

    it("counts nothing up to the read that finds quiet over", () => {
      const clock = advanceTaskClock(
        startTaskClock(OPENED, QUIET_MS),
        OPENED + QUIET_MS + 4 * SECOND,
        true
      );

      expect(clock.soundingMs).toBe(0);
    });

    it("counts nothing while the alarm cannot be heard", () => {
      expect(runTo(OPENED + QUIET_MS + 60 * SECOND, false).soundingMs).toBe(0);
    });

    // A suspended app's timer stops, and the alarm stays silent meanwhile.
    it("adds at most a short stretch for a read long after the last", () => {
      const sounding = runTo(OPENED + QUIET_MS + SECOND);
      const resumed = advanceTaskClock(sounding, OPENED + QUIET_MS + 180 * SECOND, true);

      expect(resumed.soundingMs - sounding.soundingMs).toBe(TASK_CLOCK_MAX_GAIN_MS);
      expect(wayOutShown(resumed)).toBe(false);
    });

    it("leaves out a quiet time that restarts between two sounding stretches", () => {
      const restartAt = OPENED + QUIET_MS + 10 * SECOND;
      const restarted = restartQuiet(runTo(restartAt), restartAt, QUIET_MS, true);
      const after = restartAt + QUIET_MS + 5 * SECOND;

      expect(tick(restarted, restartAt, after).soundingMs).toBe(15 * SECOND);
    });

    it("never counts the same stretch twice", () => {
      const at = OPENED + QUIET_MS + 3 * SECOND;
      const once = advanceTaskClock(startTaskClock(OPENED, QUIET_MS), at, true);

      expect(advanceTaskClock(once, at, true).soundingMs).toBe(once.soundingMs);
    });
  });

  describe("the way out", () => {
    const wayOutAt = OPENED + QUIET_MS + WAY_OUT_SOUNDING_SECONDS * SECOND;

    it("appears after enough sounding time", () => {
      expect(wayOutShown(runTo(wayOutAt - SECOND))).toBe(false);
      expect(wayOutShown(runTo(wayOutAt))).toBe(true);
    });

    it("stays once it has appeared, through a new quiet time", () => {
      const clock = restartQuiet(runTo(wayOutAt), wayOutAt, QUIET_MS, true);

      expect(wayOutShown(advanceTaskClock(clock, wayOutAt + SECOND, true))).toBe(true);
    });

    it("waits longer by each quiet time in between", () => {
      // Each quiet time restarts after ten seconds of sound.
      let clock = startTaskClock(OPENED, QUIET_MS);
      let now = OPENED;
      for (let i = 0; i < 10; i++) {
        const next = now + QUIET_MS + 10 * SECOND;
        clock = restartQuiet(tick(clock, now, next), next, QUIET_MS, true);
        now = next;
      }

      expect(clock.soundingMs).toBe(100 * SECOND);
      expect(wayOutShown(clock)).toBe(false);
    });

    it("is announced at the minute it appears", () => {
      const said = /After (\d+) minutes?/.exec(wayOutSentence(i18n.t));
      const minutes = Number(said?.[1]);
      const at = OPENED + QUIET_MS + minutes * 60 * SECOND;

      expect(minutes).toBeGreaterThan(0);
      expect(wayOutShown(runTo(at - SECOND))).toBe(false);
      expect(wayOutShown(runTo(at))).toBe(true);
    });
  });

  describe("quiet time length", () => {
    it("is longer with a screen reader on", () => {
      expect(quietSecondsFor(false)).toBe(QUIET_TIME_SECONDS.DEFAULT);
      expect(quietSecondsFor(true)).toBe(QUIET_TIME_SECONDS.SCREEN_READER);
      expect(quietSecondsFor(true)).toBeGreaterThan(quietSecondsFor(false));
    });
  });

  describe("leaving and coming back", () => {
    it("ends quiet time at once and keeps the time counted", () => {
      const at = OPENED + 10 * SECOND;
      const left = endQuiet(runTo(at), at, true);

      expect(quietPhase(left, at)).toBe(QUIET_PHASE.SOUNDING);
      expect(left.soundingMs).toBe(0);
    });

    it("leaves a quiet time that is already over where it ended", () => {
      const at = OPENED + QUIET_MS + 10 * SECOND;
      const left = endQuiet(runTo(at), at, true);

      expect(left.quietUntil).toBe(OPENED + QUIET_MS);
      expect(left.soundingMs).toBe(10 * SECOND);
    });

    it("counts none of the time the task was closed", () => {
      const leftAt = OPENED + QUIET_MS + 20 * SECOND;
      const left = endQuiet(runTo(leftAt), leftAt, true);
      const backAt = leftAt + 90 * SECOND;
      const back = tick(resumeTaskClock(left, backAt), backAt, backAt + 5 * SECOND);

      expect(back.soundingMs).toBe(left.soundingMs + 5 * SECOND);
    });
  });

  describe("quiet bar", () => {
    it("drains from full to empty over the quiet time", () => {
      const clock = startTaskClock(OPENED, QUIET_MS);

      expect(quietFraction(clock, OPENED, false)).toBe(1);
      expect(quietFraction(clock, OPENED + QUIET_MS / 2, false)).toBe(0.5);
      expect(quietFraction(clock, OPENED + QUIET_MS, false)).toBe(0);
      expect(quietFraction(clock, OPENED + 2 * QUIET_MS, false)).toBe(0);
    });

    it("moves in whole steps under Reduce Motion", () => {
      const clock = startTaskClock(OPENED, QUIET_MS);
      const step = QUIET_BAR_STEP_SECONDS * SECOND;
      const within = [OPENED + 1, OPENED + step / 2, OPENED + step - 1];

      const fractions = within.map((now) => quietFraction(clock, now, true));
      expect(new Set(fractions).size).toBe(1);
      expect(quietFraction(clock, OPENED + step, true)).toBeLessThan(fractions[0]);
    });
  });
});
