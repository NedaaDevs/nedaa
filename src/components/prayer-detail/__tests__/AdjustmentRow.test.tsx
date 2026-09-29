import { Text } from "react-native";
import { usePathname } from "expo-router";
import { act, screen, userEvent } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { AdjustmentRow } from "@/components/prayer-detail/AdjustmentRow";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { PRAYER_ID } from "@/constants/Prayer";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { controlProblems } from "@/test-helpers/controls";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

import type { AladhanTuning } from "@/types/providers/aladhan";

const ALADHAN_ID = PRAYER_TIME_PROVIDERS.ALADHAN.id;
const OTHER_PROVIDER_ID = "other-provider";

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const useTuning = (tune: Partial<AladhanTuning>, providerId: string = ALADHAN_ID) =>
  useProviderSettingsStore.setState({
    currentProviderId: providerId,
    allSettings: {
      [ALADHAN_ID]: { tune: { ...PRAYER_TIME_PROVIDERS.ALADHAN.tuning, ...tune } },
    },
  });

const renderRow = () =>
  renderRouter(
    {
      [BACK_DESTINATION.HOME.route]: () => (
        <>
          <AdjustmentRow prayerId={PRAYER_ID.FAJR} />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_PROVIDER.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.HOME.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const rowNamed = (status: string) =>
  screen.getByRole("button", {
    name: `${i18n.t("prayerDetail.adjustment.title")}, ${status}`,
  });

describe("AdjustmentRow", () => {
  afterEach(async () => {
    await act(() => i18n.changeLanguage(AppLocale.EN));
  });

  it("says the prayer is not adjusted when its offset is zero", async () => {
    useTuning({ [PRAYER_ID.FAJR]: 0, [PRAYER_ID.ISHA]: 4 });
    await renderRow();

    expect(rowNamed(i18n.t("prayerDetail.adjustment.none"))).toBeTruthy();
  });

  it("reads a positive offset as minutes later", async () => {
    useTuning({ [PRAYER_ID.FAJR]: 5 });
    await renderRow();

    expect(rowNamed("5 minutes later")).toBeTruthy();
  });

  it("reads a negative offset as minutes earlier, without a sign", async () => {
    useTuning({ [PRAYER_ID.FAJR]: -1 });
    await renderRow();

    expect(rowNamed("1 minute earlier")).toBeTruthy();
  });

  it("writes the minutes in the reader's digits", async () => {
    usePreferencesStore.setState({ useWesternNumerals: false });
    useTuning({ [PRAYER_ID.FAJR]: 5 });
    await act(() => i18n.changeLanguage(AppLocale.AR));
    await renderRow();

    expect(screen.getByRole("button").props.accessibilityLabel).toContain("٥");
  });

  // Only Aladhan takes per-prayer minutes; another provider sets the time itself.
  it("names no minutes for a provider without per-prayer tuning", async () => {
    useTuning({ [PRAYER_ID.FAJR]: 5 }, OTHER_PROVIDER_ID);
    await renderRow();

    expect(rowNamed(i18n.t("prayerDetail.adjustment.byProvider"))).toBeTruthy();
  });

  it("opens the provider settings, and says so", async () => {
    useTuning({ [PRAYER_ID.FAJR]: 5 });
    await renderRow();

    const row = rowNamed("5 minutes later");
    expect(row.props.accessibilityHint).toBe(i18n.t("a11y.prayerDetail.adjustment.hint"));

    await userEvent.press(row);

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_PROVIDER.href)
    );
  });

  it("gives the row a role, a name and a 44pt target", async () => {
    useTuning({});
    await renderRow();

    expect(controlProblems()).toEqual([]);
  });
});
