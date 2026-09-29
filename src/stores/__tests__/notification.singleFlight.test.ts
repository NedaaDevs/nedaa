import { useNotificationStore } from "@/stores/notification";
import { NOTIFICATION_FIELD, NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_ID } from "@/constants/Prayer";
import type { PrayerSoundKey } from "@/constants/sounds";
import type { SchedulingResult } from "@/types/notification";
import { scheduleAllNotifications } from "@/utils/notificationScheduler";

jest.mock("expo-linking", () => ({ openSettings: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ cancelAllScheduledNotifications: jest.fn() }));
jest.mock("@/utils/notificationScheduler", () => ({
  scheduleAllNotifications: jest.fn(),
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
const FIRST_COUNT = 3;
const FOLLOW_UP_COUNT = 7;

type Deferred = {
  promise: Promise<SchedulingResult>;
  resolve: (result: SchedulingResult) => void;
  reject: (error: Error) => void;
};

// A scheduler run the test settles by hand, so a second call can land mid-run.
const deferred = (): Deferred => {
  let resolve: Deferred["resolve"] = () => {};
  let reject: Deferred["reject"] = () => {};
  const promise = new Promise<SchedulingResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const done = (scheduledCount: number): SchedulingResult => ({ success: true, scheduledCount });

// Lets the store's run reach the scheduler: it awaits the qada lookups first.
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const store = () => useNotificationStore.getState();
const scheduler = scheduleAllNotifications as jest.Mock;

beforeEach(() => {
  scheduler.mockReset();
  useNotificationStore.setState((state) => ({
    settings: { ...state.settings, enabled: true, overrides: {} },
    pendingReschedule: false,
    batchDepth: 0,
  }));
});

describe("scheduleAllNotifications single-flight", () => {
  it("never starts a second run while one is in progress", async () => {
    const first = deferred();
    scheduler.mockReturnValueOnce(first.promise);

    const running = store().scheduleAllNotifications();
    await settle();
    const waiting = store().scheduleAllNotifications();
    await settle();

    expect(scheduler).toHaveBeenCalledTimes(1);

    scheduler.mockResolvedValueOnce(done(FOLLOW_UP_COUNT));
    first.resolve(done(FIRST_COUNT));
    await Promise.all([running, waiting]);
  });

  it("coalesces every call during a run into one follow-up run", async () => {
    const first = deferred();
    const followUp = deferred();
    scheduler.mockReturnValueOnce(first.promise).mockReturnValueOnce(followUp.promise);

    const running = store().scheduleAllNotifications();
    await settle();
    const waiting = [
      store().scheduleAllNotifications(),
      store().scheduleAllNotifications(),
      store().scheduleAllNotifications(),
    ];

    first.resolve(done(FIRST_COUNT));
    await expect(running).resolves.toEqual(done(FIRST_COUNT));
    await settle();
    expect(scheduler).toHaveBeenCalledTimes(2);

    followUp.resolve(done(FOLLOW_UP_COUNT));
    await expect(Promise.all(waiting)).resolves.toEqual([
      done(FOLLOW_UP_COUNT),
      done(FOLLOW_UP_COUNT),
      done(FOLLOW_UP_COUNT),
    ]);
    expect(scheduler).toHaveBeenCalledTimes(2);
  });

  // A run reads the settings once, so a write mid-run waits for the follow-up.
  it("schedules a write made during a run in the follow-up", async () => {
    const first = deferred();
    scheduler.mockReturnValueOnce(first.promise).mockResolvedValueOnce(done(FOLLOW_UP_COUNT));

    const running = store().scheduleAllNotifications();
    await settle();
    const writing = store().updateOverride(
      PRAYER_ID.FAJR,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_FIELD.SOUND,
      SOUND
    );
    first.resolve(done(FIRST_COUNT));
    await Promise.all([running, writing]);

    expect(scheduler).toHaveBeenCalledTimes(2);
    const [settingsSeenByFollowUp] = scheduler.mock.calls[1];
    expect(settingsSeenByFollowUp.overrides[PRAYER_ID.FAJR][NOTIFICATION_TYPE.PRAYER]).toEqual({
      sound: SOUND,
    });
  });

  // A caller resuming off the settled run lands before the follow-up starts.
  it("joins the queued follow-up when called as the run settles", async () => {
    const first = deferred();
    const followUp = deferred();
    scheduler.mockReturnValueOnce(first.promise).mockReturnValueOnce(followUp.promise);

    const running = store().scheduleAllNotifications();
    await settle();
    const waiting = store().scheduleAllNotifications();
    const late = running.then(() => store().scheduleAllNotifications());

    first.resolve(done(FIRST_COUNT));
    await running;
    await settle();

    expect(scheduler).toHaveBeenCalledTimes(2);
    followUp.resolve(done(FOLLOW_UP_COUNT));
    await expect(Promise.all([waiting, late])).resolves.toEqual([
      done(FOLLOW_UP_COUNT),
      done(FOLLOW_UP_COUNT),
    ]);
  });

  it("starts no follow-up when nothing asked during the run", async () => {
    scheduler.mockResolvedValue(done(FIRST_COUNT));

    await store().scheduleAllNotifications();
    await settle();

    expect(scheduler).toHaveBeenCalledTimes(1);
  });

  it("still runs the follow-up when the run in progress throws", async () => {
    const first = deferred();
    scheduler.mockReturnValueOnce(first.promise).mockResolvedValueOnce(done(FOLLOW_UP_COUNT));

    const running = store().scheduleAllNotifications();
    await settle();
    const waiting = store().scheduleAllNotifications();
    first.reject(new Error("scheduler crashed"));

    await expect(running).rejects.toThrow("scheduler crashed");
    await expect(waiting).resolves.toEqual(done(FOLLOW_UP_COUNT));
  });

  it("starts a fresh run for a call after the previous one settled", async () => {
    scheduler.mockResolvedValue(done(FIRST_COUNT));

    await store().scheduleAllNotifications();
    await store().scheduleAllNotifications();

    expect(scheduler).toHaveBeenCalledTimes(2);
  });

  // A flush that lands after a later write must leave that write owed.
  it("keeps a debt recorded while a flush is in progress", async () => {
    const flush = deferred();
    scheduler.mockReturnValueOnce(flush.promise);

    const firstSession = store().withBatch(async () => {
      await store().updateOverride(
        PRAYER_ID.FAJR,
        NOTIFICATION_TYPE.PRAYER,
        NOTIFICATION_FIELD.SOUND,
        SOUND
      );
    });
    await settle();
    expect(scheduler).toHaveBeenCalledTimes(1);

    await store().withBatch(async () => {
      await store().updateOverride(
        PRAYER_ID.ASR,
        NOTIFICATION_TYPE.PRAYER,
        NOTIFICATION_FIELD.VIBRATION,
        false
      );
      flush.resolve(done(FIRST_COUNT));
      await firstSession;
      expect(store().pendingReschedule).toBe(true);
      scheduler.mockResolvedValueOnce(done(FOLLOW_UP_COUNT));
    });

    expect(scheduler).toHaveBeenCalledTimes(2);
    expect(store().pendingReschedule).toBe(false);
  });
});
