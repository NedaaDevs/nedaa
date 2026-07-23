import { toScheduledAlarmType } from "@/utils/alarmTypes";
import { ScheduledAlarmType } from "@/enums/alarm";

describe("toScheduledAlarmType", () => {
  it("maps the friday settings key to the jummah scheduled type", () => {
    // Native fire paths look alarm settings up by the *scheduled* type ("jummah");
    // persisting under the settings key ("friday") made every Jummah customization
    // fall back to defaults at fire time.
    expect(toScheduledAlarmType("friday")).toBe(ScheduledAlarmType.JUMMAH);
  });

  it("maps fajr to fajr", () => {
    expect(toScheduledAlarmType("fajr")).toBe(ScheduledAlarmType.FAJR);
  });
});
