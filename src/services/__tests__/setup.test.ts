import { appSetup } from "@/services/setup";
import { ensureAlarmsScheduled } from "@/utils/alarmScheduler";

const mockClearPendingReapply = jest.fn();

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
  const scheduleAllNotifications = jest.fn(async () => {});
  await appSetup({ loadPrayerTimes } as never, { scheduleAllNotifications } as never);
  return loadPrayerTimes;
};

beforeEach(() => jest.clearAllMocks());

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
