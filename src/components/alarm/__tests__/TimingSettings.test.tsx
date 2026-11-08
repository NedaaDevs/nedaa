import { screen, userEvent, within } from "@testing-library/react-native";

import TimingSettings from "@/components/alarm/TimingSettings";
import {
  ALARM_TIMING_CHOICES,
  ALARM_TIMING_MODE,
  ALARM_TYPE,
  timingForMode,
} from "@/constants/Alarm";
import i18n from "@/localization/i18n";
import { loadSavedSettings, SAVED_TIMINGS } from "@/test-helpers/alarmSettings";
import { renderWithTheme } from "@/test-helpers/theme";
import type { AlarmType, TimingConfig } from "@/types/alarm";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const BEFORE_30: TimingConfig = { mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME, minutesBefore: 30 };
const AT_PRAYER = i18n.t("alarm.settings.atPrayerTime");
const BEFORE_PRAYER = i18n.t("alarm.settings.beforePrayerTime");

const minutes = (count: number) => i18n.t("common.minute", { count });

/** The names of the choice groups the picker can draw. */
const GROUP_NAMES = [i18n.t("alarm.settings.timing"), i18n.t("alarm.settings.minutesBefore")];

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

  it("reads one step as chosen, never every step up to it", async () => {
    await renderTiming(ALARM_TYPE.FRIDAY, BEFORE_30);

    expect(screen.getByRole("radio", { selected: true })).toBe(
      screen.getByRole("radio", { name: minutes(30) })
    );
  });

  it("writes the step pressed", async () => {
    const onChange = jest.fn();
    await renderTiming(ALARM_TYPE.FRIDAY, BEFORE_30, onChange);

    await userEvent.press(screen.getByRole("radio", { name: minutes(45) }));

    expect(onChange).toHaveBeenCalledWith({ ...BEFORE_30, minutesBefore: 45 });
  });

  // VoiceOver does not speak a group's name, so the caption stays readable.
  it("names the steps' group and leaves its caption readable", async () => {
    await renderTiming(ALARM_TYPE.FRIDAY, BEFORE_30);

    const caption = i18n.t("alarm.settings.minutesBefore");
    expect(screen.getByLabelText(caption)).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getByText(caption)).toBeOnTheScreen();
  });

  // The before steps leave out zero, which is the at-prayer mode.
  it("marks no step for an offset outside the steps, and saves the step pressed", async () => {
    const onChange = jest.fn();
    const zero = { mode: ALARM_TIMING_MODE.BEFORE_PRAYER_TIME, minutesBefore: 0 };
    await renderTiming(ALARM_TYPE.FAJR, zero, onChange);
    const [first] = offsets(ALARM_TYPE.FAJR);

    expect(screen.getByRole("radio", { name: minutes(first) })).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ selected: false })
    );

    await userEvent.press(screen.getByRole("radio", { name: minutes(first) }));

    expect(onChange).toHaveBeenCalledWith({ ...zero, minutesBefore: first });
  });

  it.each(SAVED_TIMINGS)(
    "marks a choice in each group for a loaded $alarmType $timing.mode $timing.minutesBefore",
    async ({ alarmType, timing }) => {
      const { timing: loaded } = await loadSavedSettings(alarmType, { timing });
      await renderTiming(alarmType, loaded);

      const groups = GROUP_NAMES.flatMap((name) => screen.queryAllByLabelText(name));
      expect(groups).not.toHaveLength(0);
      groups.forEach((group) =>
        expect(within(group).getAllByRole("radio", { selected: true })).toHaveLength(1)
      );
    }
  );

  it("moves Fajr before prayer at its default offset", async () => {
    const onChange = jest.fn();
    await renderTiming(
      ALARM_TYPE.FAJR,
      { mode: ALARM_TIMING_MODE.AT_PRAYER_TIME, minutesBefore: 0 },
      onChange
    );

    await userEvent.press(screen.getByRole("radio", { name: BEFORE_PRAYER }));

    expect(onChange).toHaveBeenCalledWith(
      timingForMode(ALARM_TYPE.FAJR, ALARM_TIMING_MODE.BEFORE_PRAYER_TIME)
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
