import { screen, userEvent } from "@testing-library/react-native";

import SolvedPanel from "@/components/alarm/challenges/SolvedPanel";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { ScheduledAlarmType } from "@/enums/alarm";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { renderWithTheme } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const t = i18n.t.bind(i18n);
const ALARM_ID = "alarm-1";
/** Jumuah, Friday 25 September 2026, at 12:10 in UTC. */
const JUMUAH = new Date("2026-09-25T12:10:00.000Z");
const MINUTE_MS = 60_000;
let mockNow = JUMUAH;
jest.mock("@/hooks/useMinuteClock", () => ({ useMinuteClock: () => mockNow }));

const DAY: DayPrayerTimes = {
  date: 20260925,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-25T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: JUMUAH.toISOString(),
    [PRAYER_ID.ASR]: "2026-09-25T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-25T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-25T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-25T05:50:00.000Z",
    [OTHER_TIMING.SUNSET]: "2026-09-25T18:05:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

const setUp = async (at: Date, alarmType = ScheduledAlarmType.JUMMAH) => {
  mockNow = at;
  jest.setSystemTime(at);
  const onClose = jest.fn();
  await renderWithTheme(<SolvedPanel alarmId={ALARM_ID} alarmType={alarmType} onClose={onClose} />);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  return { onClose, user };
};

describe("SolvedPanel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: true });
    usePrayerTimesStore.setState({ todayTimings: DAY, tomorrowTimings: null });
  });
  afterEach(() => jest.useRealTimers());

  it("says the alarm stopped, and when its prayer began", async () => {
    await setUp(new Date(JUMUAH.getTime() + 5 * MINUTE_MS));

    expect(screen.getByRole("header", { name: t("alarm.solved.title") })).toBeVisible();
    const prayer = t("prayerTimes.jumuah");
    expect(screen.getByText(t("alarm.solved.began", { prayer, time: "12:10 PM" }))).toBeVisible();
  });

  it("says when its prayer begins, solved before it", async () => {
    await setUp(new Date(JUMUAH.getTime() - 20 * MINUTE_MS));

    const prayer = t("prayerTimes.jumuah");
    expect(screen.getByText(t("alarm.solved.begins", { prayer, time: "12:10 PM" }))).toBeVisible();
  });

  it("names no prayer for a custom alarm", async () => {
    await setUp(JUMUAH, ScheduledAlarmType.CUSTOM);

    expect(screen.getByRole("header", { name: t("alarm.solved.title") })).toBeVisible();
    expect(screen.queryByText(/12:10/)).toBeNull();
  });

  it("shows no time when none is stored", async () => {
    usePrayerTimesStore.setState({ todayTimings: null, tomorrowTimings: null });
    await setUp(JUMUAH);

    expect(screen.queryByText(t("prayerTimes.jumuah"), { exact: false })).toBeNull();
  });

  it("closes at a press", async () => {
    const { onClose, user } = await setUp(JUMUAH);

    await user.press(screen.getByRole("button", { name: t("common.close") }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
