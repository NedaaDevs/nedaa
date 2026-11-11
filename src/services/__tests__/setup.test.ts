import { appSetup } from "@/services/setup";
import { CITY_CHECK_TRIGGER } from "@/constants/CityCheck";
import { ensureAlarmsScheduled } from "@/utils/alarmScheduler";

const mockClearPendingReapply = jest.fn();
const mockRunCityCheck = jest.fn();
const mockScreenshotMode = { on: false };

jest.mock("@/services/cityCheck", () => ({
  runCityCheck: (trigger: string) => mockRunCityCheck(trigger),
}));
jest.mock("@/screenshot-mode/flag", () => ({
  get IS_SCREENSHOT_MODE() {
    return mockScreenshotMode.on;
  },
}));

jest.mock("@/stores/providerSettings", () => ({
  awaitPendingReapply: async () => true,
  useProviderSettingsStore: {
    getState: () => ({ clearPendingReapply: mockClearPendingReapply }),
  },
}));
jest.mock("@/stores/qada", () => ({
  useQadaStore: { getState: () => ({ loadData: async () => {} }) },
}));
jest.mock("@/stores/umrahGuide", () => ({
  useUmrahGuideStore: { getState: () => ({ initializeDb: async () => {} }) },
}));
jest.mock("@/utils/alarmScheduler", () => ({
  ensureAlarmsScheduled: jest.fn(async () => {}),
  waitForAlarmStores: async () => {},
}));
jest.mock("@/utils/alarmCopy", () => ({ registerAlarmCopySync: () => {} }));
jest.mock("@/utils/foregroundReschedule", () => ({ registerForegroundReschedule: () => {} }));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: () => {} }));
jest.mock("@/services/widgetPayloads", () => ({ syncWidgetPayloads: async () => {} }));
jest.mock("@/services/widgetDiagnostics", () => ({ logLaunchWidgetAttachContext: () => {} }));
jest.mock("@/tasks/backgroundRefresh", () => ({ registerBackgroundRefresh: async () => {} }));
jest.mock("@/services/background-task-log", () => ({
  BackgroundTaskLog: { initialize: async () => {} },
}));
jest.mock("@/services/umrah-db", () => ({ UmrahDB: { flush: async () => {} } }));
jest.mock("@/services/cleanup", () => ({ cleanupManager: { register: () => {} } }));
jest.mock("@/utils/appLogger", () => {
  const log = { d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() };
  return { AppLogger: { create: () => log } };
});

/** Runs the launch setup with a load that resolves `landed`. */
const launch = async (landed: boolean) => {
  const loadPrayerTimes = jest.fn(async () => landed);
  await appSetup({ loadPrayerTimes } as never, { scheduleAllNotifications } as never);
  return loadPrayerTimes;
};

const scheduleAllNotifications = jest.fn(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  mockScreenshotMode.on = false;
  mockRunCityCheck.mockReturnValue(Promise.resolve());
});

describe("appSetup city check", () => {
  it("starts the city check at launch without waiting for it", async () => {
    mockRunCityCheck.mockReturnValue(new Promise(() => {}));

    await launch(true);

    expect(mockRunCityCheck).toHaveBeenCalledWith(CITY_CHECK_TRIGGER.LAUNCH);
    expect(scheduleAllNotifications).toHaveBeenCalled();
  });

  it("skips the city check in screenshot mode", async () => {
    mockScreenshotMode.on = true;

    await launch(true);

    expect(mockRunCityCheck).not.toHaveBeenCalled();
  });
});

describe("appSetup with a pending reapply", () => {
  it("forces the load", async () => {
    const loadPrayerTimes = await launch(true);

    expect(loadPrayerTimes).toHaveBeenCalledWith(true);
  });

  it("clears the reapply flag once every year lands", async () => {
    await launch(true);

    expect(mockClearPendingReapply).toHaveBeenCalledTimes(1);
  });

  // Next year's rows hold the old settings until their own fetch lands.
  it("keeps the reapply flag while the load owes a year", async () => {
    await launch(false);

    expect(mockClearPendingReapply).not.toHaveBeenCalled();
    expect(ensureAlarmsScheduled).toHaveBeenCalled();
  });
});
