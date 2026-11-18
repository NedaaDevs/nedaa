import { Alert } from "react-native";
import { fireEvent, screen, userEvent, within } from "@testing-library/react-native";

import Settings from "@/components/athkar/Settings";
import { HOLD } from "@/components/ui/hold-to-confirm";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import type { AthkarState } from "@/types/athkar";

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
const mockResetProgress = jest.fn(async () => {});
const mockPeriod: { current: AthkarState["currentType"] } = { current: ATHKAR_TYPE.MORNING };
jest.mock("@/stores/athkar", () => ({
  useAthkarStore: () => ({
    settings: { showStreak: false, showTranslation: false },
    shortVersion: false,
    currentType: mockPeriod.current,
    resetProgress: () => mockResetProgress(),
  }),
}));
// The fill is reanimated, which cannot load under jest; it is drawing only.
jest.mock("@/components/ui/hold-to-confirm/Fill", () => ({ Fill: () => null }));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
// The row reads the store through a selector and draws a look; it has its own suite.
const mockLookRow = "look-row";
jest.mock("@/components/athkar/looks/LookRow", () => {
  const { View } = jest.requireActual("react-native");
  return { LookRow: () => <View testID={mockLookRow} /> };
});

const t = i18n.t.bind(i18n);

const timeButton = (spoken: string) =>
  screen.getByRole("button", {
    name: t("a11y.join", { first: t("settings.athkar.notifications.time"), second: spoken }),
  });

describe("Athkar settings look", () => {
  it("puts the look row above the reminders", async () => {
    await renderWithTheme(<Settings />);

    expect(screen.getByTestId(mockLookRow)).toBeOnTheScreen();
    const drawn = JSON.stringify(screen.toJSON());
    const row = drawn.indexOf(mockLookRow);
    for (const period of [ATHKAR_TYPE.MORNING, ATHKAR_TYPE.EVENING]) {
      const reminder = drawn.indexOf(t(`settings.athkar.notifications.${period}.title`));
      expect(reminder).toBeGreaterThan(row);
    }
  });
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

describe("Athkar settings switches", () => {
  // Nothing on the Athkar screens draws a streak.
  it("offers no streak switch", async () => {
    await renderWithTheme(<Settings />);

    expect(screen.queryByText(t("settings.athkar.showStreak.title"))).toBeNull();
    expect(
      screen.queryByRole("switch", { name: t("settings.athkar.showStreak.title") })
    ).toBeNull();
  });
});

describe("Athkar settings reset", () => {
  const reset = () => screen.getByRole("button", { name: t("common.resetDailyProgress") });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  const hold = (ms: number) =>
    userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).longPress(reset(), {
      duration: ms,
    });

  it.each([
    [ATHKAR_TYPE.MORNING, "athkar.session.resetMessage.morning"],
    [ATHKAR_TYPE.EVENING, "athkar.session.resetMessage.evening"],
  ] as const)(
    "names the %s counts a reset returns to zero, beside the control",
    async (period, key) => {
      mockPeriod.current = period;
      await renderWithTheme(<Settings />);

      expect(screen.getByText(t(key))).toBeOnTheScreen();
      mockPeriod.current = ATHKAR_TYPE.MORNING;
    }
  );

  it("resets the session after a full hold", async () => {
    await renderWithTheme(<Settings />);
    await hold(HOLD.DEFAULT_MS + HOLD.TICK_MS / 10);

    expect(mockResetProgress).toHaveBeenCalledTimes(1);
  });

  it("keeps the counts when the hold ends early", async () => {
    await renderWithTheme(<Settings />);
    await hold(HOLD.DEFAULT_MS - HOLD.TICK_MS);

    expect(mockResetProgress).not.toHaveBeenCalled();
  });

  it("asks a screen reader's person before it resets", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderWithTheme(<Settings />);
    fireEvent(reset(), "accessibilityTap");

    expect(alert).toHaveBeenCalledWith(
      t("common.resetDailyProgress"),
      t("athkar.session.resetMessage.morning"),
      expect.any(Array)
    );
    expect(mockResetProgress).not.toHaveBeenCalled();
    // The hold instruction is for a finger; the dialog replaces it.
    expect(screen.queryByText(t("a11y.athkar.holdToResetHint"))).toBeNull();
    expect(
      screen.getByText(t("a11y.athkar.holdToResetHint"), { includeHiddenElements: true })
    ).toBeOnTheScreen();
  });
});
