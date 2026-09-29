import { screen, userEvent } from "@testing-library/react-native";

import TimingSettings from "@/components/alarm/TimingSettings";
import { ALARM_TIMING_CHOICES, ALARM_TIMING_MODE, ALARM_TYPE } from "@/constants/Alarm";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import type { AlarmType, TimingConfig } from "@/types/alarm";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const BEFORE_30: TimingConfig = { mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME, minutesBefore: 30 };
const AT_PRAYER = i18n.t("alarm.settings.atPrayerTime");
const BEFORE_PRAYER = i18n.t("alarm.settings.beforePrayerTime");

/** The offsets drawn as steps; a zero offset is the at-prayer mode. */
const offsets = (alarmType: AlarmType) =>
  ALARM_TIMING_CHOICES[alarmType].minuteSteps.filter((minutes) => minutes > 0);

const renderTiming = (alarmType: AlarmType, value: TimingConfig, onChange = jest.fn()) =>
  renderWithTheme(<TimingSettings value={value} alarmType={alarmType} onChange={onChange} />);

describe("TimingSettings", () => {
  it("offers Friday its before-prayer steps and no at-prayer choice", async () => {
    await renderTiming(ALARM_TYPE.FRIDAY, BEFORE_30);

    expect(screen.queryByRole("radio", { name: AT_PRAYER })).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(offsets(ALARM_TYPE.FRIDAY).length);
  });

  it("offers Fajr both modes and its before-prayer steps", async () => {
    await renderTiming(ALARM_TYPE.FAJR, BEFORE_30);

    expect(screen.getByRole("radio", { name: AT_PRAYER })).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: BEFORE_PRAYER })).toBeOnTheScreen();
    expect(screen.getAllByRole("radio")).toHaveLength(
      ALARM_TIMING_CHOICES[ALARM_TYPE.FAJR].modes.length + offsets(ALARM_TYPE.FAJR).length
    );
  });

  it("clears the offset when Fajr moves to prayer time", async () => {
    const onChange = jest.fn();
    await renderTiming(ALARM_TYPE.FAJR, BEFORE_30, onChange);

    await userEvent.press(screen.getByRole("radio", { name: AT_PRAYER }));

    expect(onChange).toHaveBeenCalledWith({
      mode: ALARM_TIMING_MODE.AT_PRAYER_TIME,
      minutesBefore: 0,
    });
  });
});
