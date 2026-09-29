import { AccessibilityInfo } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";

import { AlertsHeader } from "@/components/prayer-detail/AlertsHeader";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_ID } from "@/constants/Prayer";
import i18n from "@/localization/i18n";
import { useNotificationStore } from "@/stores/notification";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("expo-linking", () => ({ openSettings: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ cancelAllScheduledNotifications: jest.fn() }));
jest.mock("@/utils/notificationScheduler", () => ({
  scheduleAllNotifications: jest.fn(() => Promise.resolve({ success: true, scheduledCount: 0 })),
  shouldReschedule: jest.fn(() => false),
}));
jest.mock("@/utils/customSoundManager", () => ({ buildUsedSoundsSet: jest.fn(() => new Set()) }));
jest.mock("@/services/qada-db", () => ({
  QadaDB: {
    flush: jest.fn(),
    getSettings: jest.fn(() => Promise.resolve(null)),
    getRemainingCount: jest.fn(() => Promise.resolve(0)),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({ locationDetails: { timezone: "UTC" } })) },
}));
jest.mock("@/stores/prayerTimes", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({ twoWeeksTimings: [] })) },
}));

const PRAYER = PRAYER_ID.FAJR;
const OTHER = PRAYER_ID.ASR;
const INITIAL_SETTINGS = useNotificationStore.getState().settings;

const TAG = i18n.t("prayerDetail.alertsHeader.custom");
const RESET = i18n.t("prayerDetail.alertsHeader.reset");

const reset = () => screen.queryByRole("button", { name: RESET });
const overrides = () => useNotificationStore.getState().settings.overrides;

beforeEach(() => {
  useNotificationStore.setState({
    settings: {
      ...INITIAL_SETTINGS,
      overrides: {
        [PRAYER]: {
          [NOTIFICATION_TYPE.PRAYER]: { vibration: false },
          [NOTIFICATION_TYPE.IQAMA]: { timing: 20 },
        },
        [OTHER]: { [NOTIFICATION_TYPE.PRE_ATHAN]: { enabled: true } },
      },
    },
    pendingReschedule: false,
    batchDepth: 0,
  });
});

describe("AlertsHeader", () => {
  it("shows nothing while the prayer follows the defaults", async () => {
    useNotificationStore.setState({ settings: { ...INITIAL_SETTINGS, overrides: {} } });
    await renderWithTheme(<AlertsHeader prayerId={PRAYER} />);

    expect(screen.queryByText(TAG)).not.toBeOnTheScreen();
    expect(reset()).not.toBeOnTheScreen();
  });

  // The tag names the state in words, so colour is never its only signal.
  it("says in words that the prayer has its own alerts", async () => {
    await renderWithTheme(<AlertsHeader prayerId={PRAYER} />);

    expect(screen.getByText(TAG)).toBeOnTheScreen();
    expect(reset()).toBeOnTheScreen();
  });

  it("resets only this prayer, and says so", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await renderWithTheme(<AlertsHeader prayerId={PRAYER} />);

    await userEvent.setup().press(reset()!);

    expect(overrides()[PRAYER]).toBeUndefined();
    expect(overrides()[OTHER]).toEqual({ [NOTIFICATION_TYPE.PRE_ATHAN]: { enabled: true } });
    expect(announce).toHaveBeenCalledWith(i18n.t("a11y.prayerDetail.alertsHeader.resetDone"));
    expect(screen.queryByText(TAG)).not.toBeOnTheScreen();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderWithTheme(<AlertsHeader prayerId={PRAYER} />);

    expect(reset()!.props.accessibilityHint).toBe(
      i18n.t("a11y.prayerDetail.alertsHeader.resetHint")
    );
    expect(controlProblems()).toEqual([]);
  });
});
