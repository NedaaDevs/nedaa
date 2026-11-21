import Storage from "expo-sqlite/kv-store";
import { CHALLENGE_DIFFICULTY, CHALLENGE_TYPE } from "expo-alarm";

import {
  ALARM_TIMING_CHOICES,
  ALARM_TIMING_MODE,
  ALARM_TYPE,
  timingForMode,
} from "@/constants/Alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { WAKE_TASK_DEFAULT_STEPS, WAKE_TASK_ID, WAKE_TASK_MAX_STEPS } from "@/constants/WakeTask";
import { loadRawSettings, loadSavedSettings, SAVED_TIMINGS } from "@/test-helpers/alarmSettings";
import {
  DEFAULT_CHALLENGE_CONFIG,
  DEFAULT_TIMING_CONFIG,
  type AlarmTypeSettings,
  type ChallengeConfig,
  type WakeTask,
} from "@/types/alarm";
import { applyTimingOffset } from "@/utils/alarmTrigger";

const INITIAL = useAlarmSettingsStore.getState();
const PRAYER_AT = new Date(2026, 10, 8, 5, 0);
const { HARD, MEDIUM } = CHALLENGE_DIFFICULTY;
const MATH_HARD_7: ChallengeConfig = { type: CHALLENGE_TYPE.MATH, difficulty: HARD, count: 7 };
const MATH_HARD_MAX: WakeTask = {
  id: WAKE_TASK_ID.MATH,
  difficulty: HARD,
  steps: WAKE_TASK_MAX_STEPS,
};
const PRAYERS: WakeTask = { id: WAKE_TASK_ID.PRAYERS };
const PATTERN: WakeTask = { id: WAKE_TASK_ID.PATTERN, difficulty: MEDIUM, steps: 2 };

/** A saved blob as an older build wrote it, `tasks` absent. */
const withoutTasks = ({ tasks: _tasks, ...rest }: AlarmTypeSettings) => rest;

describe("alarm settings store", () => {
  afterEach(() => useAlarmSettingsStore.setState(INITIAL, true));

  it.each(Object.values(ALARM_TYPE))("starts %s on a timing it offers", (alarmType) => {
    const { timing } = INITIAL[alarmType];
    const choices = ALARM_TIMING_CHOICES[alarmType];

    expect(choices.modes).toContain(timing.mode);
    if (timing.mode === ALARM_TIMING_MODE.BEFORE_PRAYER_TIME) {
      expect(choices.minuteSteps).toContain(timing.minutesBefore);
    }
  });

  it("gives saved settings without a timing each type's default", async () => {
    jest.mocked(Storage.getItem).mockResolvedValueOnce(
      JSON.stringify({
        state: { [ALARM_TYPE.FAJR]: { enabled: true }, [ALARM_TYPE.FRIDAY]: { enabled: true } },
        version: 0,
      })
    );

    await useAlarmSettingsStore.persist.rehydrate();

    const { fajr, friday } = useAlarmSettingsStore.getState();
    expect(fajr.timing).toEqual(DEFAULT_TIMING_CONFIG);
    expect(friday.timing).toEqual(INITIAL.friday.timing);
    expect(friday.enabled).toBe(true);
  });

  it.each(SAVED_TIMINGS)(
    "keeps when a saved $alarmType $timing.mode $timing.minutesBefore rings",
    async ({ alarmType, timing }) => {
      const { timing: loaded } = await loadSavedSettings(alarmType, { timing });

      expect(applyTimingOffset(PRAYER_AT, loaded)).toEqual(applyTimingOffset(PRAYER_AT, timing));
    }
  );

  // Zero minutes before rings at the prayer time.
  it("reads a saved Fajr zero minutes before as at prayer time", async () => {
    const { timing: loaded } = await loadSavedSettings(ALARM_TYPE.FAJR, {
      timing: { mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME, minutesBefore: 0 },
    });

    expect(loaded).toEqual(timingForMode(ALARM_TYPE.FAJR, ALARM_TIMING_MODE.AT_PRAYER_TIME));
  });

  it.each(Object.values(ALARM_TYPE))(
    "gives a saved %s without tasks the stack its challenge stands for",
    async (alarmType) => {
      const saved = { ...withoutTasks(INITIAL[alarmType]), challenge: MATH_HARD_7 };
      const loaded = await loadSavedSettings(alarmType, saved);

      expect(loaded.tasks).toEqual([MATH_HARD_MAX]);
      expect(loaded.challenge).toEqual(MATH_HARD_7);
    }
  );

  it("reads saved tasks through the same checks as any stored value", async () => {
    const { tasks } = await loadRawSettings(ALARM_TYPE.FAJR, {
      tasks: [PRAYERS, { id: "puzzle" }, PRAYERS, { id: WAKE_TASK_ID.DHIKR, steps: 0 }],
    });

    expect(tasks).toEqual([PRAYERS, { id: WAKE_TASK_ID.DHIKR, steps: WAKE_TASK_DEFAULT_STEPS }]);
  });

  it.each([null, WAKE_TASK_ID.TAP, { id: WAKE_TASK_ID.TAP }])(
    "reads saved tasks %p as the stack the saved challenge stands for",
    async (tasks) => {
      const loaded = await loadRawSettings(ALARM_TYPE.FRIDAY, { challenge: MATH_HARD_7, tasks });

      expect(loaded.tasks).toEqual([MATH_HARD_MAX]);
    }
  );

  it("rebuilds saved tasks that an older build left behind", async () => {
    const loaded = await loadSavedSettings(ALARM_TYPE.FAJR, {
      challenge: MATH_HARD_7,
      tasks: [PATTERN, PRAYERS],
    });

    expect(loaded.challenge).toEqual(MATH_HARD_7);
    expect(loaded.tasks).toEqual([MATH_HARD_MAX]);
  });

  // The ring screen indexes tables by the challenge type.
  it("reads a saved challenge of an unknown type as the default type", async () => {
    const loaded = await loadRawSettings(ALARM_TYPE.FAJR, {
      ...withoutTasks(INITIAL.fajr),
      challenge: { type: "puzzle", difficulty: HARD, count: 3 },
    });

    expect(loaded.challenge).toEqual({ ...DEFAULT_CHALLENGE_CONFIG, difficulty: HARD, count: 3 });
    expect(loaded.tasks).toEqual([{ id: WAKE_TASK_ID.TAP }]);
  });

  it("stores tasks with the challenge the native overlay runs for them", () => {
    useAlarmSettingsStore
      .getState()
      .updateSettings(ALARM_TYPE.FAJR, { tasks: [PATTERN, PRAYERS, PATTERN] });

    const { tasks, challenge } = useAlarmSettingsStore.getState().fajr;
    expect(tasks).toEqual([PATTERN, PRAYERS]);
    expect(challenge).toEqual({ ...DEFAULT_CHALLENGE_CONFIG, type: CHALLENGE_TYPE.TAP });
  });

  it("stores a challenge with the stack it stands for", () => {
    useAlarmSettingsStore.getState().updateSettings(ALARM_TYPE.FRIDAY, { tasks: [PATTERN] });
    useAlarmSettingsStore.getState().setChallenge(ALARM_TYPE.FRIDAY, MATH_HARD_7);

    const { tasks, challenge } = useAlarmSettingsStore.getState().friday;
    expect(tasks).toEqual([MATH_HARD_MAX]);
    expect(challenge).toEqual(MATH_HARD_7);
  });
});
