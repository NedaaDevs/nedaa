import { screen } from "@testing-library/react-native";

import OtherRemindersSettings from "@/app/settings/otherReminders";
import { MIDNIGHT_MODE, PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { renderWithTheme } from "@/test-helpers/theme";
import type { AladhanMidnightModeId } from "@/types/providers/aladhan";

jest.mock("@/components/ui/screen-header", () => ({ ScreenHeader: () => null }));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("@/hooks/useNotificationSettings", () => ({
  useNotificationSettings: () => ({
    otherTimingNotifications: {},
    duhaTime: { hour: 9, minute: 0 },
    updateOtherTimingNotification: jest.fn(),
    updateDuhaTime: jest.fn(),
  }),
}));
// The prayer-times store opens SQLite; the screen needs only today's timings.
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: (select: (state: { todayTimings: null }) => unknown) =>
    select({ todayTimings: null }),
}));

const NIGHT = "notification.otherTiming.group.night.description";
const ALADHAN_ID = PRAYER_TIME_PROVIDERS.ALADHAN.id;

const useMidnightMode = (midnightMode: AladhanMidnightModeId) =>
  useProviderSettingsStore.setState({
    currentProviderId: ALADHAN_ID,
    allSettings: { [ALADHAN_ID]: { midnightMode } },
  });

describe("Other reminders", () => {
  beforeAll(() => i18n.changeLanguage(AppLocale.EN));

  // AlAdhan splits the night by the midnight mode, so the note names that span.
  it.each([
    [MIDNIGHT_MODE.STANDARD, `${NIGHT}.standard`],
    [MIDNIGHT_MODE.JAFARI, `${NIGHT}.jafari`],
  ])("describes the night for midnight mode %i", async (mode, key) => {
    useMidnightMode(mode);
    await renderWithTheme(<OtherRemindersSettings />);

    expect(screen.getByText(i18n.t(key))).toBeOnTheScreen();
  });
});
