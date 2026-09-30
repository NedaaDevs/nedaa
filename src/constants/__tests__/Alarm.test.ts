import {
  ALARM_TIMING_CHOICES,
  ALARM_TIMING_MODE,
  ALARM_TYPE,
  timingForMode,
} from "@/constants/Alarm";

describe("timingForMode", () => {
  it.each(Object.values(ALARM_TYPE))("puts %s before prayer at one of its own steps", (type) => {
    const { minutesBefore } = timingForMode(type, ALARM_TIMING_MODE.BEFORE_PRAYER_TIME);

    expect(minutesBefore).toBeGreaterThan(0);
    expect(ALARM_TIMING_CHOICES[type].minuteSteps).toContain(minutesBefore);
  });

  it.each(Object.values(ALARM_TYPE))("gives %s no offset at prayer time", (type) => {
    expect(timingForMode(type, ALARM_TIMING_MODE.AT_PRAYER_TIME)).toEqual({
      mode: ALARM_TIMING_MODE.AT_PRAYER_TIME,
      minutesBefore: 0,
    });
  });
});
