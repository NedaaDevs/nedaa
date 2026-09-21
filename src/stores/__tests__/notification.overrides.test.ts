import { useNotificationStore } from "@/stores/notification";
import { NOTIFICATION_TYPE } from "@/constants/Notification";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

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

const store = () => useNotificationStore.getState();
const overrideFor = (prayerId: string) => store().settings.overrides[prayerId];

beforeEach(() => {
  useNotificationStore.setState((state) => ({
    settings: { ...state.settings, overrides: {} },
  }));
});

describe("updateOverride merge semantics", () => {
  it("keeps an earlier field when a later write sets a different one", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { sound: "athan2" });
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { vibration: false });

    expect(overrideFor("fajr")[NOTIFICATION_TYPE.PRAYER]).toEqual({
      sound: "athan2",
      vibration: false,
    });
  });

  it("replaces the value when a later write sets the same field", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { sound: "athan2" });
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { sound: "medinaAthan" });

    expect(overrideFor("fajr")[NOTIFICATION_TYPE.PRAYER]?.sound).toBe("medinaAthan");
  });

  it("leaves a sibling type untouched", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { sound: "athan2" });
    await store().updateOverride("fajr", NOTIFICATION_TYPE.IQAMA, { timing: 25 });

    expect(overrideFor("fajr")[NOTIFICATION_TYPE.PRAYER]?.sound).toBe("athan2");
    expect(overrideFor("fajr")[NOTIFICATION_TYPE.IQAMA]?.timing).toBe(25);
  });

  it("leaves another prayer untouched", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { enabled: false });
    await store().updateOverride("asr", NOTIFICATION_TYPE.PRAYER, { enabled: true });

    expect(overrideFor("fajr")[NOTIFICATION_TYPE.PRAYER]?.enabled).toBe(false);
    expect(overrideFor("asr")[NOTIFICATION_TYPE.PRAYER]?.enabled).toBe(true);
  });
});

// The settings modal saves a full diff against the defaults, so its write has to drop
// the fields it omits.
describe("replaceOverride", () => {
  it("drops a field the new config omits", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, {
      sound: "athan2",
      vibration: false,
    });
    await store().replaceOverride("fajr", NOTIFICATION_TYPE.PRAYER, { vibration: false });

    expect(overrideFor("fajr")[NOTIFICATION_TYPE.PRAYER]).toEqual({ vibration: false });
  });

  it("leaves a sibling type untouched", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.IQAMA, { timing: 25 });
    await store().replaceOverride("fajr", NOTIFICATION_TYPE.PRAYER, { enabled: false });

    expect(overrideFor("fajr")[NOTIFICATION_TYPE.IQAMA]?.timing).toBe(25);
  });

  it("removes the type when handed an empty config", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { sound: "athan2" });
    await store().replaceOverride("fajr", NOTIFICATION_TYPE.PRAYER, {});

    expect(overrideFor("fajr")).toBeUndefined();
  });
});

describe("override removal is explicit", () => {
  it("does not remove an override when an empty config is written", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { sound: "athan2" });
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, {});

    expect(overrideFor("fajr")[NOTIFICATION_TYPE.PRAYER]?.sound).toBe("athan2");
  });

  it("removes the type through resetOverride", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { sound: "athan2" });
    await store().resetOverride("fajr", NOTIFICATION_TYPE.PRAYER);

    expect(overrideFor("fajr")).toBeUndefined();
  });

  it("keeps a sibling type when one type is reset", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { sound: "athan2" });
    await store().updateOverride("fajr", NOTIFICATION_TYPE.IQAMA, { timing: 25 });
    await store().resetOverride("fajr", NOTIFICATION_TYPE.PRAYER);

    expect(overrideFor("fajr")[NOTIFICATION_TYPE.PRAYER]).toBeUndefined();
    expect(overrideFor("fajr")[NOTIFICATION_TYPE.IQAMA]?.timing).toBe(25);
  });
});

describe("getEffectiveConfigForPrayer", () => {
  it("layers the override over the defaults", async () => {
    await store().updateOverride("fajr", NOTIFICATION_TYPE.PRAYER, { sound: "athan2" });

    const config = store().getEffectiveConfigForPrayer("fajr", NOTIFICATION_TYPE.PRAYER);
    const defaults = store().settings.defaults.prayer;

    expect(config.sound).toBe("athan2");
    expect(config.vibration).toBe(defaults.vibration);
    expect(config.enabled).toBe(defaults.enabled);
  });

  it("returns the defaults for a prayer with no override", () => {
    const config = store().getEffectiveConfigForPrayer("asr", NOTIFICATION_TYPE.PRAYER);

    expect(config).toEqual(store().settings.defaults.prayer);
  });

  // Friday renames Dhuhr to Jumu'ah for display only, so the override must still resolve.
  it("resolves a dhuhr override regardless of the weekday", async () => {
    await store().updateOverride("dhuhr", NOTIFICATION_TYPE.PRAYER, { sound: "athan2" });

    expect(store().getEffectiveConfigForPrayer("dhuhr", NOTIFICATION_TYPE.PRAYER).sound).toBe(
      "athan2"
    );
    expect(store().settings.overrides["jumuah"]).toBeUndefined();
  });
});

describe("persisted shape", () => {
  it("keeps the persist key and carries no zustand schema version", () => {
    const options = useNotificationStore.persist.getOptions();

    expect(options.name).toBe("notification-storage");
    // zustand reports version 0 for a store that declares none.
    expect(options.version ?? 0).toBe(0);
    expect(options.migrate).toBeUndefined();
  });
});
