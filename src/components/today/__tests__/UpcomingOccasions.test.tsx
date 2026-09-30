import { Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent, within } from "@testing-library/react-native";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { formatInTimeZone } from "date-fns-tz";

import {
  DAY_FORMAT,
  OCCASIONS_PART,
  UpcomingOccasions,
} from "@/components/today/UpcomingOccasions";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { IMPORTANT_DAYS, type ImportantDayDef } from "@/constants/ImportantDays";
import { AppLocale, AppMode, TextSize } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { controlProblems } from "@/test-helpers/controls";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import { localizeDigits } from "@/utils/digits";
import type { UpcomingImportantDay, upcomingImportantDays } from "@/utils/importantDays";

type UpcomingArgs = Parameters<typeof upcomingImportantDays>[0];

// The registry math has its own tests; here the list is whatever the day holds.
const mockUpcoming = jest.fn((_args: UpcomingArgs): UpcomingImportantDay[] => []);
jest.mock("@/utils/importantDays", () => ({
  upcomingImportantDays: (args: UpcomingArgs) => mockUpcoming(args),
}));

const TZ = "Asia/Riyadh";
const HIJRI_YEAR = 1448;
const [FIRST, SECOND, THIRD] = IMPORTANT_DAYS;

const occasion = (def: ImportantDayDef, daysRemaining: number): UpcomingImportantDay => ({
  ...def,
  hijriYear: HIJRI_YEAR,
  daysRemaining,
  expectedGregorian: new Date(0),
});

const digits = (text: string) =>
  localizeDigits(
    text,
    useAppStore.getState().locale,
    usePreferencesStore.getState().useWesternNumerals
  );

/** The one line a screen reader speaks for a row. */
const labelOf = (def: ImportantDayDef, remaining: string) =>
  `${i18n.t(def.i18nKey)}, ${remaining}, ${digits(
    `${def.hijriDay} ${i18n.t(`hijriMonths.${def.hijriMonth - 1}`)} ${HIJRI_YEAR}`
  )}`;

const inDays = (count: number) => i18n.t("importantDays.inDays", { count });

/** A figure drawn with digits alone: the number beside its unit. */
const NUMBER_ONLY = /^[0-9٠-٩]+$/;

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderOccasions = ({ isRTL = false } = {}) =>
  renderRouter(
    {
      [BACK_DESTINATION.HOME.route]: () => (
        <>
          <UpcomingOccasions />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.IMPORTANT_DAYS.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.HOME.href as string,
      wrapper: ({ children }) => <ThemeProvider isRTL={isRTL}>{children}</ThemeProvider>,
    }
  );

const seeAll = () => screen.getByRole("button", { name: i18n.t("importantDays.seeAll") });

const useArabic = async (useWesternNumerals = false) => {
  await act(() => i18n.changeLanguage(AppLocale.AR));
  useAppStore.setState({ locale: AppLocale.AR });
  usePreferencesStore.setState({ useWesternNumerals });
};

describe("UpcomingOccasions", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T09:00:00.000Z") });
    mockUpcoming.mockReset();
    mockUpcoming.mockReturnValue([occasion(FIRST, 42), occasion(SECOND, 72)]);
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ mode: AppMode.LIGHT, locale: AppLocale.EN, hijriDaysOffset: 0 });
    usePreferencesStore.setState({ useWesternNumerals: false, textSize: TextSize.DEFAULT });
    useLocationStore.setState({
      locationDetails: { ...useLocationStore.getState().locationDetails, timezone: TZ },
    });
  });
  afterEach(() => jest.useRealTimers());

  it("heads the module and reads each of the two nearest as one line", async () => {
    await renderOccasions();

    expect(screen.getByRole("header", { name: i18n.t("importantDays.upcoming") })).toBeTruthy();
    const first = screen.getByLabelText(labelOf(FIRST, inDays(42)));
    expect(within(first).getByText(i18n.t(FIRST.i18nKey))).toBeTruthy();
    expect(within(first).getByText("42")).toBeTruthy();
    expect(within(first).getByText(i18n.t("importantDays.days", { count: 42 }))).toBeTruthy();
    expect(screen.getByLabelText(labelOf(SECOND, inDays(72)))).toBeTruthy();
  });

  it("shows only the nearest two of several", async () => {
    mockUpcoming.mockReturnValue([occasion(FIRST, 4), occasion(SECOND, 5), occasion(THIRD, 9)]);
    await renderOccasions();

    expect(screen.getByLabelText(labelOf(SECOND, inDays(5)))).toBeTruthy();
    expect(screen.queryByLabelText(labelOf(THIRD, inDays(9)))).toBeNull();
  });

  it("closes up to one row when one remains", async () => {
    mockUpcoming.mockReturnValue([occasion(FIRST, 12)]);
    await renderOccasions();

    expect(screen.getByLabelText(labelOf(FIRST, inDays(12)))).toBeTruthy();
    expect(screen.queryByText(i18n.t(SECOND.i18nKey))).toBeNull();
    expect(seeAll()).toBeTruthy();
  });

  it("hides itself, heading and link too, when none remains", async () => {
    mockUpcoming.mockReturnValue([]);
    await renderOccasions();

    expect(screen.queryByRole("header", { name: i18n.t("importantDays.upcoming") })).toBeNull();
    expect(screen.queryByRole("button", { name: i18n.t("importantDays.seeAll") })).toBeNull();
  });

  it("asks for the location's day with the user's Hijri correction", async () => {
    useAppStore.setState({ hijriDaysOffset: -1 });
    await renderOccasions();

    const [args] = mockUpcoming.mock.lastCall ?? [];
    expect(args).toMatchObject({ timezone: TZ, hijriDaysOffset: -1 });
    expect(args?.now && formatInTimeZone(args.now, TZ, DAY_FORMAT)).toBe("2026-09-23");
  });

  // 20:58 UTC is 23:58 in Riyadh: one tick stays in the day, the next turns it.
  it("reads the list again when the day turns, not on each minute", async () => {
    jest.setSystemTime(new Date("2026-09-23T20:58:00.000Z"));
    await renderOccasions();
    const calls = mockUpcoming.mock.calls.length;

    await act(() => jest.advanceTimersByTime(60_000));
    expect(mockUpcoming).toHaveBeenCalledTimes(calls);

    await act(() => jest.advanceTimersByTime(60_000));
    expect(mockUpcoming).toHaveBeenCalledTimes(calls + 1);
    const [args] = mockUpcoming.mock.lastCall ?? [];
    expect(args?.now && formatInTimeZone(args.now, TZ, DAY_FORMAT)).toBe("2026-09-24");
  });

  it("words today and tomorrow instead of counting them", async () => {
    mockUpcoming.mockReturnValue([occasion(FIRST, 0), occasion(SECOND, 1)]);
    await renderOccasions();

    const today = screen.getByLabelText(labelOf(FIRST, i18n.t("importantDays.today")));
    const tomorrow = screen.getByLabelText(labelOf(SECOND, i18n.t("importantDays.tomorrow")));
    expect(within(today).getByText(i18n.t("importantDays.today"))).toBeTruthy();
    expect(within(tomorrow).getByText(i18n.t("importantDays.tomorrow"))).toBeTruthy();
    expect(within(today).queryByText(NUMBER_ONLY)).toBeNull();
    expect(within(tomorrow).queryByText(NUMBER_ONLY)).toBeNull();
  });

  // Arabic names two with the dual word alone; a numeral before it is wrong.
  it("names two days with the Arabic dual word and no numeral", async () => {
    await useArabic();
    mockUpcoming.mockReturnValue([occasion(FIRST, 2)]);
    await renderOccasions({ isRTL: true });

    const row = screen.getByLabelText(labelOf(FIRST, inDays(2)));
    expect(within(row).getByText(i18n.t("importantDays.twoDays"))).toBeTruthy();
    expect(within(row).queryByText(NUMBER_ONLY)).toBeNull();
  });

  it("counts two days with a number where the language has no dual", async () => {
    mockUpcoming.mockReturnValue([occasion(FIRST, 2)]);
    await renderOccasions();

    const row = screen.getByLabelText(labelOf(FIRST, inDays(2)));
    expect(within(row).getByText("2")).toBeTruthy();
    expect(within(row).queryByText(i18n.t("importantDays.twoDays"))).toBeNull();
  });

  it("redraws its digits when the numeral preference changes", async () => {
    await useArabic();
    await renderOccasions({ isRTL: true });
    expect(screen.getByText("٤٢")).toBeTruthy();

    await act(() => usePreferencesStore.setState({ useWesternNumerals: true }));

    expect(screen.getByText("42")).toBeTruthy();
  });

  it("opens every occasion from its link", async () => {
    await renderOccasions();

    const link = seeAll();
    expect(link.props.accessibilityHint).toBe(
      i18n.t("a11y.opens", { name: i18n.t("importantDays.title") })
    );

    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(link);

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.IMPORTANT_DAYS.href)
    );
  });

  it.each([false, true])("points the link's chevron onward (rtl: %s)", async (isRTL) => {
    await renderOccasions({ isRTL });

    expect(
      screen.getByTestId(isRTL ? OCCASIONS_PART.CHEVRON_LEFT : OCCASIONS_PART.CHEVRON_RIGHT, {
        includeHiddenElements: true,
      })
    ).toBeTruthy();
  });

  // Jest lays nothing out, so this pins the rule: the row wraps, no part shrinks.
  it.each(Object.values(TextSize))(
    "at text size %s wraps the figure under the name rather than squeeze either",
    async (textSize) => {
      usePreferencesStore.setState({ textSize });
      await renderOccasions();

      const row = screen.getByLabelText(labelOf(FIRST, inDays(42)));
      expect(row).toHaveStyle({ flexDirection: "row", flexWrap: "wrap" });
      expect(within(row).getByTestId(OCCASIONS_PART.NAME)).toHaveStyle({ flexShrink: 0 });
      expect(within(row).getByTestId(OCCASIONS_PART.FIGURE)).toHaveStyle({ flexShrink: 0 });
    }
  );

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderOccasions();

    expect(controlProblems()).toEqual([]);
  });
});
