import { screen, userEvent, within } from "@testing-library/react-native";

import Settings from "@/components/athkar/Settings";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";

const mockReminders = {
  morningNotification: { enabled: true, hour: 6, minute: 0 },
  eveningNotification: { enabled: true, hour: 17, minute: 30 },
  updateAthkarNotificationSetting: jest.fn(),
};

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
// The real stores open SQLite and reach the notification scheduler.
jest.mock("@/stores/notification", () => ({ useNotificationStore: () => mockReminders }));
jest.mock("@/stores/athkar", () => ({
  useAthkarStore: () => ({
    settings: { showStreak: false, showTranslation: false },
    shortVersion: false,
  }),
}));

const t = i18n.t.bind(i18n);

const timeButton = (spoken: string) =>
  screen.getByRole("button", {
    name: t("a11y.join", { first: t("settings.athkar.notifications.time"), second: spoken }),
  });

describe("Athkar settings reminder time", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
    usePreferencesStore.setState({ use24HourTime: false });
  });

  it("names each reminder button with the time it shows", async () => {
    await renderWithTheme(<Settings />);

    const morning = timeButton(t("a11y.time.am", { time: "6:00" }));
    const evening = timeButton(t("a11y.time.pm", { time: "5:30" }));
    expect(within(morning).getByText("06:00")).toBeTruthy();
    expect(within(evening).getByText("05:30")).toBeTruthy();
  });

  // The drawn times keep the 12-hour clock, so the spoken ones do too.
  it("keeps the 12-hour clock for a reader who prefers 24 hours", async () => {
    usePreferencesStore.setState({ use24HourTime: true });
    await renderWithTheme(<Settings />);

    expect(timeButton(t("a11y.time.pm", { time: "5:30" }))).toBeTruthy();
  });

  it("says each period once, on the time button", async () => {
    await renderWithTheme(<Settings />);

    for (const note of [
      t("settings.athkar.notifications.morning.time.note"),
      t("settings.athkar.notifications.evening.time.note"),
    ]) {
      expect(screen.getByText(note, { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByText(note, { includeHiddenElements: false })).toBeNull();
    }
  });

  it("says the reminder label once, on each time button", async () => {
    await renderWithTheme(<Settings />);

    const label = t("settings.athkar.notifications.time");
    expect(screen.getAllByText(label, { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryAllByText(label, { includeHiddenElements: false })).toHaveLength(0);
  });

  it.each([
    {
      type: ATHKAR_TYPE.MORNING,
      spoken: t("a11y.time.am", { time: "6:00" }),
      title: t("settings.athkar.notifications.morning.title"),
    },
    {
      type: ATHKAR_TYPE.EVENING,
      spoken: t("a11y.time.pm", { time: "5:30" }),
      title: t("settings.athkar.notifications.evening.title"),
    },
  ])("titles the picker with the $type reminder", async ({ spoken, title }) => {
    await renderWithTheme(<Settings />);

    await userEvent.press(timeButton(spoken));

    expect(screen.getByRole("header", { name: title })).toBeTruthy();
  });
});
