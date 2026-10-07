import { act, renderHook } from "@testing-library/react-native";

import { AppLocale } from "@/enums/app";
import { useTodayDates } from "@/hooks/useTodayDates";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";

// hijri-native is a native module; the hook reads today's Hijri date from it.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

const hijriOn = (day: number) => `${day} ${i18n.t("hijriMonths.3")} 1448`;

describe("useTodayDates", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T09:00:00.000Z") });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ locale: AppLocale.EN, hijriDaysOffset: 1 });
    usePreferencesStore.setState({ useWesternNumerals: false });
    useLocationStore.setState({
      locationDetails: { ...useLocationStore.getState().locationDetails, timezone: "UTC" },
    });
  });
  afterEach(() => jest.useRealTimers());

  it("dates today with the user's Hijri correction", async () => {
    const { result } = await renderHook(() => useTodayDates());

    expect(result.current).toEqual({
      hijri: hijriOn(13),
      gregorian: i18n.t("today.gregorianDate", { day: "Wednesday", date: "23 September 2026" }),
    });
  });

  it("applies an offset given in place of the saved one", async () => {
    const { result } = await renderHook(() => useTodayDates(-3));

    expect(result.current.hijri).toBe(hijriOn(9));
  });

  it("shows no correction for an offset of zero", async () => {
    const { result } = await renderHook(() => useTodayDates(0));

    expect(result.current.hijri).toBe(hijriOn(12));
  });

  it("writes the dates in Arabic-Indic digits for Arabic", async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    useAppStore.setState({ locale: AppLocale.AR });

    const { result } = await renderHook(() => useTodayDates(0));

    expect(result.current.hijri).toBe(`١٢ ${i18n.t("hijriMonths.3")} ١٤٤٨`);
  });
});
