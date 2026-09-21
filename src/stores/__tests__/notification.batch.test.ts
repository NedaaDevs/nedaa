import { useNotificationStore } from "@/stores/notification";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_ID } from "@/constants/Prayer";
import type { PrayerSoundKey } from "@/constants/sounds";
import { scheduleAllNotifications } from "@/utils/notificationScheduler";
import { clearTransientSchedulingState } from "@/stores/notificationTransientState";

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

const SOUND: PrayerSoundKey = "athan2";

const store = () => useNotificationStore.getState();
const scheduler = scheduleAllNotifications as jest.Mock;

beforeEach(() => {
  scheduler.mockClear();
  useNotificationStore.setState((state) => ({
    settings: { ...state.settings, overrides: {} },
    pendingReschedule: false,
    batchDepth: 0,
  }));
});

describe("batched writes", () => {
  it("schedules once per write outside a batch", async () => {
    await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });
    await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { vibration: false });

    expect(scheduler).toHaveBeenCalledTimes(2);
  });

  it("schedules once for a whole batch", async () => {
    await store().withBatch(async () => {
      await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });
      await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { vibration: false });
      await store().updateOverride(PRAYER_ID.ASR, NOTIFICATION_TYPE.IQAMA, { timing: 20 });
      expect(scheduler).not.toHaveBeenCalled();
    });

    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it("still applies every write to state while batching", async () => {
    await store().withBatch(async () => {
      await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });
      await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { vibration: false });
    });

    expect(store().settings.overrides[PRAYER_ID.FAJR][NOTIFICATION_TYPE.PRAYER]).toEqual({
      sound: SOUND,
      vibration: false,
    });
  });

  it("schedules nothing when a batch wrote nothing", async () => {
    await store().withBatch(async () => {});

    expect(scheduler).not.toHaveBeenCalled();
  });

  it("defers a reset alongside the writes", async () => {
    await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });
    scheduler.mockClear();

    await store().withBatch(async () => {
      await store().resetOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER);
      expect(scheduler).not.toHaveBeenCalled();
    });

    expect(scheduler).toHaveBeenCalledTimes(1);
    expect(store().settings.overrides[PRAYER_ID.FAJR]).toBeUndefined();
  });

  it("holds the flush until the outermost batch closes", async () => {
    await store().withBatch(async () => {
      await store().withBatch(async () => {
        await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });
      });
      expect(scheduler).not.toHaveBeenCalled();
    });

    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it("returns to immediate scheduling after a batch closes", async () => {
    await store().withBatch(async () => {
      await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });
    });
    scheduler.mockClear();

    await store().updateOverride(PRAYER_ID.ASR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });

    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it("records the owed reschedule while the batch is open", async () => {
    await store().withBatch(async () => {
      await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });
      expect(store().pendingReschedule).toBe(true);
    });
  });

  it("clears the owed reschedule once the batch flushes", async () => {
    await store().withBatch(async () => {
      await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });
    });

    expect(store().pendingReschedule).toBe(false);
  });

  // The scope the caller cannot leave open: a throw still closes the batch and pays
  // what the writes owed.
  it("closes the batch and still schedules when the body throws", async () => {
    await expect(
      store().withBatch(async () => {
        await store().updateOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(scheduler).toHaveBeenCalledTimes(1);
    expect(store().batchDepth).toBe(0);
    expect(store().pendingReschedule).toBe(false);
  });

  it("returns to immediate scheduling after a throw", async () => {
    await store()
      .withBatch(async () => {
        throw new Error("boom");
      })
      .catch(() => {});
    scheduler.mockClear();

    await store().updateOverride(PRAYER_ID.ASR, NOTIFICATION_TYPE.PRAYER, { sound: SOUND });

    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it("hands back what the body returned", async () => {
    await expect(store().withBatch(async () => "done")).resolves.toBe("done");
  });

  // A batch belongs to the screen that opened it, so a process death leaves a depth
  // nothing will close. The debt it recorded has to outlive that same death.
  it("drops the batch depth but keeps the debt when a process dies mid-batch", () => {
    const survivor = clearTransientSchedulingState({
      isScheduling: true,
      batchDepth: 2,
      pendingReschedule: true,
    });

    expect(survivor.batchDepth).toBe(0);
    expect(survivor.isScheduling).toBe(false);
    expect(survivor.pendingReschedule).toBe(true);
  });
});
