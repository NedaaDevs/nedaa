import Storage from "expo-sqlite/kv-store";

import {
  ALARM_TIMING_CHOICES,
  ALARM_TIMING_MODE,
  ALARM_TYPE,
  timingForMode,
} from "@/constants/Alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { loadSavedSettings, SAVED_TIMINGS } from "@/test-helpers/alarmSettings";
import { DEFAULT_TIMING_CONFIG } from "@/types/alarm";
import { applyTimingOffset } from "@/utils/alarmTrigger";

const INITIAL = useAlarmSettingsStore.getState();
const PRAYER_AT = new Date(2026, 10, 8, 5, 0);

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

  it.each(Object.values(ALARM_TYPE))("resets %s to the timing it starts on", (alarmType) => {
    const { setTiming, resetToDefaults } = useAlarmSettingsStore.getState();
    setTiming(alarmType, { mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME, minutesBefore: 90 });

    resetToDefaults(alarmType);

    expect(useAlarmSettingsStore.getState()[alarmType].timing).toEqual(INITIAL[alarmType].timing);
  });
});
