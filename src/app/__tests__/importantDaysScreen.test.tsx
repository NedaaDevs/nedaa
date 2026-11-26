import { act, screen } from "@testing-library/react-native";

import ImportantDaysScreen from "@/app/important-days";
import { IMPORTANT_DAYS } from "@/constants/ImportantDays";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import { localizeDigits } from "@/utils/digits";
import type { UpcomingImportantDay } from "@/utils/importantDays";

jest.mock("@/components/ui/screen-header", () => ({ ScreenHeader: () => null }));

let mockDays: UpcomingImportantDay[] = [];
jest.mock("@/utils/importantDays", () => ({ upcomingImportantDays: () => mockDays }));

const EXPECTED = new Date("2027-02-08T00:00:00Z");
const HIJRI_YEAR = 1448;

const nearest = (daysRemaining: number): UpcomingImportantDay => ({
  ...IMPORTANT_DAYS[0],
  hijriYear: HIJRI_YEAR,
  daysRemaining,
  expectedGregorian: EXPECTED,
});

const arabic = (value: number) => localizeDigits(String(value), AppLocale.AR, false);

describe("Important Days screen", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage(AppLocale.AR));
    useAppStore.setState({ locale: AppLocale.AR, hijriDaysOffset: 0 });
    usePreferencesStore.setState({ useWesternNumerals: false });
  });
  afterAll(async () => {
    await act(() => i18n.changeLanguage(AppLocale.EN));
  });

  it("names two days with the Arabic dual word and no digit", async () => {
    mockDays = [nearest(2)];
    await renderWithTheme(<ImportantDaysScreen />);

    expect(screen.getByText(i18n.t("importantDays.twoDays"))).toBeTruthy();
    expect(screen.queryByText(arabic(2))).toBeNull();
  });

  it("shows the count with its unit beyond two days", async () => {
    mockDays = [nearest(5)];
    await renderWithTheme(<ImportantDaysScreen />);

    expect(screen.getByText(arabic(5))).toBeTruthy();
    expect(screen.getByText(i18n.t("importantDays.days", { count: 5 }))).toBeTruthy();
  });
});
