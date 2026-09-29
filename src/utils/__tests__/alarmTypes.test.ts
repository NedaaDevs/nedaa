import { ALARM_TYPE } from "@/constants/Alarm";
import { ScheduledAlarmType } from "@/enums/alarm";
import { toScheduledAlarmType, toSettingsAlarmType } from "@/utils/alarmTypes";

describe("toScheduledAlarmType", () => {
  it("maps the friday settings key to the jummah scheduled type", () => {
    // Native fire paths read settings by the scheduled type; the settings key
    // would leave every Jummah customization on its defaults at fire time.
    expect(toScheduledAlarmType(ALARM_TYPE.FRIDAY)).toBe(ScheduledAlarmType.JUMMAH);
  });

  it("maps fajr to fajr", () => {
    expect(toScheduledAlarmType(ALARM_TYPE.FAJR)).toBe(ScheduledAlarmType.FAJR);
  });
});

describe("toSettingsAlarmType", () => {
  it("maps the jummah scheduled type back to the friday settings key", () => {
    expect(toSettingsAlarmType(ScheduledAlarmType.JUMMAH)).toBe(ALARM_TYPE.FRIDAY);
  });

  it("maps fajr to fajr", () => {
    expect(toSettingsAlarmType(ScheduledAlarmType.FAJR)).toBe(ALARM_TYPE.FAJR);
  });

  it("returns null for custom (no per-type user settings)", () => {
    expect(toSettingsAlarmType(ScheduledAlarmType.CUSTOM)).toBeNull();
  });
});
