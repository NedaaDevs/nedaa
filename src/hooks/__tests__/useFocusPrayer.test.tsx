import { act, renderHook } from "@testing-library/react-native";

import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import { useFocusPrayer } from "@/hooks/useFocusPrayer";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";

/** 2026-09-25 is a Friday. */
const dayOn = (date: string): DayPrayerTimes => ({
  date: Number(date.replaceAll("-", "")),
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: `${date}T04:30:00.000Z`,
    [PRAYER_ID.DHUHR]: `${date}T12:00:00.000Z`,
    [PRAYER_ID.ASR]: `${date}T15:20:00.000Z`,
    [PRAYER_ID.MAGHRIB]: `${date}T18:05:00.000Z`,
    [PRAYER_ID.ISHA]: `${date}T19:25:00.000Z`,
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: `${date}T05:50:00.000Z`,
  } as DayPrayerTimes["otherTimings"],
});

const at = async (date: string, time: string, flipped?: boolean) => {
  jest.useFakeTimers({ now: new Date(`${date}T${time}:00.000Z`) });
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: dayOn(date),
    tomorrowTimings: null,
  });
  const { result } = await renderHook(() => useFocusPrayer(flipped));
  return result.current;
};

const t = i18n.t.bind(i18n);

describe("useFocusPrayer", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage(AppLocale.EN));
    usePreferencesStore.setState({ showSeconds: false });
  });
  afterEach(() => jest.useRealTimers());

  it("names the next prayer between prayers", async () => {
    expect(await at("2026-09-23", "14:02")).toMatchObject({
      label: t("today.focus.next"),
      name: t("prayerTimes.asr"),
      counted: t("prayerTimes.asr"),
    });
  });

  // For half an hour after the adhan, the prayer just come in is the one named.
  it("names the prayer just come in as the current one", async () => {
    expect(await at("2026-09-23", "15:30")).toMatchObject({
      label: t("today.focus.current"),
      name: t("prayerTimes.asr"),
    });
  });

  it("names the next prayer once flipped inside that half hour", async () => {
    expect(await at("2026-09-23", "15:30", true)).toMatchObject({
      label: t("today.focus.next"),
      name: t("prayerTimes.maghrib"),
    });
  });

  it("names Friday's Dhuhr as Jumuah", async () => {
    expect((await at("2026-09-25", "11:00"))?.name).toBe(t("prayerTimes.jumuah"));
  });

  it("names nothing with no later prayer stored", async () => {
    expect(await at("2026-09-23", "21:00")).toBeNull();
  });
});
