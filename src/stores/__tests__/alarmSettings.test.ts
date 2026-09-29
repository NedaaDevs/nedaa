import Storage from "expo-sqlite/kv-store";

import { ALARM_TIMING_CHOICES, ALARM_TIMING_MODE, ALARM_TYPE } from "@/constants/Alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { DEFAULT_TIMING_CONFIG } from "@/types/alarm";

const INITIAL = useAlarmSettingsStore.getState();

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
});
