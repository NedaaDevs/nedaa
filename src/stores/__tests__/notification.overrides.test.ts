import { useNotificationStore } from "@/stores/notification";
import { NOTIFICATION_FIELD, NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_ID } from "@/constants/Prayer";
import type { PrayerSoundKey } from "@/constants/sounds";
import { scheduleAllNotifications } from "@/utils/notificationScheduler";

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

const SOUND: PrayerSoundKey = "athan2";
const OTHER_SOUND: PrayerSoundKey = "medinaAthan";

const store = () => useNotificationStore.getState();
const overrideFor = (prayerId: string) => store().settings.overrides[prayerId];
const scheduler = scheduleAllNotifications as jest.Mock;

beforeEach(() => {
  scheduler.mockClear();
  useNotificationStore.setState((state) => ({
    settings: { ...state.settings, overrides: {} },
  }));
});

describe("updateOverride merge semantics", () => {
  it("keeps an earlier field when a later write sets a different one", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.VIBRATION,
      false
    );

    expect(overrideFor(PRAYER_ID.FAJR)[NOTIFICATION_TYPE.PRAYER]).toEqual({
      sound: SOUND,
      vibration: false,
    });
  });

  it("replaces the value when a later write sets the same field", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      OTHER_SOUND
    );

    expect(overrideFor(PRAYER_ID.FAJR)[NOTIFICATION_TYPE.PRAYER]?.sound).toBe(OTHER_SOUND);
  });

  it("leaves a sibling type untouched", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.IQAMA,
      NOTIFICATION_FIELD.TIMING,
      25
    );

    expect(overrideFor(PRAYER_ID.FAJR)[NOTIFICATION_TYPE.PRAYER]?.sound).toBe(SOUND);
    expect(overrideFor(PRAYER_ID.FAJR)[NOTIFICATION_TYPE.IQAMA]?.timing).toBe(25);
  });

  it("leaves another prayer untouched", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.ENABLED,
      false
    );
    await store().updateOverride(
      PRAYER_ID.ASR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.VIBRATION,
      false
    );

    expect(overrideFor(PRAYER_ID.FAJR)[NOTIFICATION_TYPE.PRAYER]).toEqual({ enabled: false });
    expect(overrideFor(PRAYER_ID.ASR)[NOTIFICATION_TYPE.PRAYER]).toEqual({ vibration: false });
  });
});

// An override holds only what differs from the defaults, like a modal save.
describe("updateOverride keeps only what differs from the defaults", () => {
  it("drops a field written back to its default", async () => {
    const { sound } = store().settings.defaults.prayer;
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.VIBRATION,
      false
    );
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      sound
    );

    expect(overrideFor(PRAYER_ID.FAJR)[NOTIFICATION_TYPE.PRAYER]).toEqual({ vibration: false });
  });

  it("drops the prayer's entry when its last field returns to the default", async () => {
    const { timing } = store().settings.defaults.iqama;
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.IQAMA,
      NOTIFICATION_FIELD.TIMING,
      25
    );
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.IQAMA,
      NOTIFICATION_FIELD.TIMING,
      timing
    );

    expect(overrideFor(PRAYER_ID.FAJR)).toBeUndefined();
  });

  it("stores nothing for a default value on a prayer with no override", async () => {
    const { enabled } = store().settings.defaults.prayer;
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.ENABLED,
      enabled
    );

    expect(overrideFor(PRAYER_ID.FAJR)).toBeUndefined();
    expect(scheduler).not.toHaveBeenCalled();
  });

  it("schedules nothing when the value is already stored", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
    scheduler.mockClear();

    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );

    expect(scheduler).not.toHaveBeenCalled();
  });

  it("never writes the defaults", async () => {
    const defaults = store().settings.defaults;
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );

    expect(store().settings.defaults).toBe(defaults);
  });
});

// A merge takes one field and a replace a whole config; neither fits the other.
// tsc fails the build if either directive below stops being needed.
describe("merge and replace are distinct calls", () => {
  it("rejects a config handed to the merge and a field handed to the replace", () => {
    const { FAJR } = PRAYER_ID;
    const { PRAYER } = NOTIFICATION_TYPE;
    const swapped = () => {
      // @ts-expect-error a merge takes one field, never a whole config
      void store().updateOverride(FAJR, PRAYER, { sound: SOUND });
      // @ts-expect-error a replace takes a whole config, never one field
      void store().replaceOverride(FAJR, PRAYER, NOTIFICATION_FIELD.SOUND, SOUND);
    };

    expect(swapped).toEqual(expect.any(Function));
  });
});

// The settings modal saves a full diff against the defaults, so its write has to drop
// the fields it omits.
describe("replaceOverride", () => {
  it("drops a field the new config omits", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.VIBRATION,
      false
    );
    await store().replaceOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { vibration: false });

    expect(overrideFor(PRAYER_ID.FAJR)[NOTIFICATION_TYPE.PRAYER]).toEqual({ vibration: false });
  });

  it("leaves a sibling type untouched", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.IQAMA,
      NOTIFICATION_FIELD.TIMING,
      25
    );
    await store().replaceOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { enabled: false });

    expect(overrideFor(PRAYER_ID.FAJR)[NOTIFICATION_TYPE.IQAMA]?.timing).toBe(25);
  });

  it("removes the type when handed an empty config", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
    await store().replaceOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, {});

    expect(overrideFor(PRAYER_ID.FAJR)).toBeUndefined();
  });
});

describe("override removal is explicit", () => {
  it("removes the type through resetOverride", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
    await store().resetOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER);

    expect(overrideFor(PRAYER_ID.FAJR)).toBeUndefined();
  });

  it("keeps a sibling type when one type is reset", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.IQAMA,
      NOTIFICATION_FIELD.TIMING,
      25
    );
    await store().resetOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER);

    expect(overrideFor(PRAYER_ID.FAJR)[NOTIFICATION_TYPE.PRAYER]).toBeUndefined();
    expect(overrideFor(PRAYER_ID.FAJR)[NOTIFICATION_TYPE.IQAMA]?.timing).toBe(25);
  });
});

describe("getEffectiveConfigForPrayer", () => {
  it("layers the override over the defaults", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );

    const config = store().getEffectiveConfigForPrayer(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER);
    const defaults = store().settings.defaults.prayer;

    expect(config.sound).toBe(SOUND);
    expect(config.vibration).toBe(defaults.vibration);
    expect(config.enabled).toBe(defaults.enabled);
  });

  it("returns the defaults for a prayer with no override", () => {
    const config = store().getEffectiveConfigForPrayer(PRAYER_ID.ASR, NOTIFICATION_TYPE.PRAYER);

    expect(config).toEqual(store().settings.defaults.prayer);
  });

  // Friday renames Dhuhr to Jumu'ah for display only, so the override must still resolve.
  it("resolves a dhuhr override regardless of the weekday", async () => {
    await store().updateOverride(
      PRAYER_ID.DHUHR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );

    expect(
      store().getEffectiveConfigForPrayer(PRAYER_ID.DHUHR, NOTIFICATION_TYPE.PRAYER).sound
    ).toBe(SOUND);
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
