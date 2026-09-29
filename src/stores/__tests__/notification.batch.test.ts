import { useNotificationStore } from "@/stores/notification";
import { NOTIFICATION_FIELD, NOTIFICATION_TYPE } from "@/constants/Notification";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import type { PrayerSoundKey } from "@/constants/sounds";
import { scheduleAllNotifications } from "@/utils/notificationScheduler";
import { clearTransientSchedulingState } from "@/stores/notificationTransientState";

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
// Writes replace the settings object, so this stays the store's starting point.
const INITIAL_SETTINGS = store().settings;

beforeEach(() => {
  scheduler.mockClear();
  useNotificationStore.setState({
    settings: { ...INITIAL_SETTINGS, overrides: {} },
    pendingReschedule: false,
    batchDepth: 0,
  });
});

describe("batched writes", () => {
  it("schedules once per write outside a batch", async () => {
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

    expect(scheduler).toHaveBeenCalledTimes(2);
  });

  it("schedules once for a whole batch", async () => {
    await store().withBatch(async () => {
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
        PRAYER_ID.ASR,
        NOTIFICATION_TYPE.IQAMA,
        NOTIFICATION_FIELD.TIMING,
        20
      );
      expect(scheduler).not.toHaveBeenCalled();
    });

    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it("still applies every write to state while batching", async () => {
    await store().withBatch(async () => {
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
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
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
        await store().updateOverride(
          PRAYER_ID.FAJR,
          NOTIFICATION_TYPE.PRAYER,
          NOTIFICATION_FIELD.SOUND,
          SOUND
        );
      });
      expect(scheduler).not.toHaveBeenCalled();
    });

    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it("returns to immediate scheduling after a batch closes", async () => {
    await store().withBatch(async () => {
      await store().updateOverride(
        PRAYER_ID.FAJR,
        NOTIFICATION_TYPE.PRAYER,
        NOTIFICATION_FIELD.SOUND,
        SOUND
      );
    });
    scheduler.mockClear();

    await store().updateOverride(
      PRAYER_ID.ASR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );

    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it("records the owed reschedule while the batch is open", async () => {
    await store().withBatch(async () => {
      await store().updateOverride(
        PRAYER_ID.FAJR,
        NOTIFICATION_TYPE.PRAYER,
        NOTIFICATION_FIELD.SOUND,
        SOUND
      );
      expect(store().pendingReschedule).toBe(true);
    });
  });

  it("clears the owed reschedule once the batch flushes", async () => {
    await store().withBatch(async () => {
      await store().updateOverride(
        PRAYER_ID.FAJR,
        NOTIFICATION_TYPE.PRAYER,
        NOTIFICATION_FIELD.SOUND,
        SOUND
      );
    });

    expect(store().pendingReschedule).toBe(false);
  });

  // The scope the caller cannot leave open: a throw still closes the batch and pays
  // what the writes owed.
  it("closes the batch and still schedules when the body throws", async () => {
    await expect(
      store().withBatch(async () => {
        await store().updateOverride(
          PRAYER_ID.FAJR,
          NOTIFICATION_TYPE.PRAYER,
          NOTIFICATION_FIELD.SOUND,
          SOUND
        );
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

    await store().updateOverride(
      PRAYER_ID.ASR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );

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
  // The scheduler cancels every pending notification before it can fail
  // (notificationScheduler.ts:357 then :365), so a debt cleared on a failed flush
  // leaves nothing scheduled and nothing owed.
  it("keeps the debt when the flush fails", async () => {
    await store().withBatch(async () => {
      scheduler.mockResolvedValueOnce({ success: false, scheduledCount: 0 });
      await store().updateOverride(
        PRAYER_ID.FAJR,
        NOTIFICATION_TYPE.PRAYER,
        NOTIFICATION_FIELD.SOUND,
        SOUND
      );
    });

    expect(scheduler).toHaveBeenCalledTimes(1);
    expect(store().pendingReschedule).toBe(true);
  });

  it("pays the debt on the next write after a failed flush", async () => {
    await store().withBatch(async () => {
      scheduler.mockResolvedValueOnce({ success: false, scheduledCount: 0 });
      await store().updateOverride(
        PRAYER_ID.FAJR,
        NOTIFICATION_TYPE.PRAYER,
        NOTIFICATION_FIELD.SOUND,
        SOUND
      );
    });
    scheduler.mockClear();

    await store().updateOverride(
      PRAYER_ID.ASR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );

    expect(store().pendingReschedule).toBe(false);
  });
});

// Every writer that changes what gets scheduled; each pays through requestReschedule.
const RESCHEDULING_WRITES = [
  {
    name: "updateOtherTimingNotification",
    write: () => store().updateOtherTimingNotification(OTHER_TIMING.ISHRAQ, true),
  },
  {
    name: "updateDuhaTime",
    write: () => {
      useNotificationStore.setState((state) => ({
        otherTimingNotifications: { ...state.otherTimingNotifications, [OTHER_TIMING.DUHA]: true },
      }));
      return store().updateDuhaTime(10, 30);
    },
  },
  { name: "updateFullAthanPlayback", write: () => store().updateFullAthanPlayback(true) },
  { name: "updateFullIqamaPlayback", write: () => store().updateFullIqamaPlayback(true) },
  { name: "updateAllNotificationToggle", write: () => store().updateAllNotificationToggle(true) },
  { name: "updateQuickSetup", write: () => store().updateQuickSetup(SOUND, false) },
  {
    name: "updateDefault",
    write: () => store().updateDefault(NOTIFICATION_TYPE.IQAMA, NOTIFICATION_FIELD.ENABLED, true),
  },
  { name: "resetAllOverrides", write: () => store().resetAllOverrides() },
  {
    name: "updateAthkarNotificationSetting",
    write: () =>
      store().updateAthkarNotificationSetting({
        type: ATHKAR_TYPE.MORNING,
        enabled: true,
        hour: 6,
        minute: 0,
      }),
  },
  { name: "updateSettings", write: () => store().updateSettings(store().settings) },
];

describe("every rescheduling write goes through requestReschedule", () => {
  it.each(RESCHEDULING_WRITES)("$name schedules once outside a batch", async ({ write }) => {
    await write();

    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it.each(RESCHEDULING_WRITES)("$name defers to the batch's one flush", async ({ write }) => {
    await store().withBatch(async () => {
      await write();
      expect(scheduler).not.toHaveBeenCalled();
      expect(store().pendingReschedule).toBe(true);
    });

    expect(scheduler).toHaveBeenCalledTimes(1);
  });
});

describe("a reset that removes nothing", () => {
  it("schedules nothing for a prayer with no override", async () => {
    await store().resetOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER);

    expect(scheduler).not.toHaveBeenCalled();
  });

  it("schedules nothing when the prayer overrides only another type", async () => {
    await store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.IQAMA,
      NOTIFICATION_FIELD.TIMING,
      20
    );
    scheduler.mockClear();

    await store().resetOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER);

    expect(scheduler).not.toHaveBeenCalled();
    expect(store().settings.overrides[PRAYER_ID.FAJR][NOTIFICATION_TYPE.IQAMA]).toEqual({
      timing: 20,
    });
  });

  // The settings modal saves an empty diff as a replace with no fields.
  it("schedules nothing when an empty replace meets no override", async () => {
    await store().replaceOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER, {});

    expect(scheduler).not.toHaveBeenCalled();
  });

  it("owes nothing inside a batch", async () => {
    await store().withBatch(async () => {
      await store().resetOverride(PRAYER_ID.FAJR, NOTIFICATION_TYPE.PRAYER);
    });

    expect(store().pendingReschedule).toBe(false);
    expect(scheduler).not.toHaveBeenCalled();
  });
});
