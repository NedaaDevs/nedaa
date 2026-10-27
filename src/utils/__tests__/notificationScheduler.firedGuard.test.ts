import { Platform } from "react-native";
import { cancelAllAthans } from "expo-alarm";

import { ATHKAR_TYPE } from "@/constants/Athkar";
import { FIRED_LEDGER } from "@/constants/FiredPrayerGuard";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { PlatformType } from "@/enums/app";
import { readLedger } from "@/services/firedPrayerLedger";
import { memoryKvFailure, resetMemoryKv } from "@/test-helpers/memoryKvStore";
import type {
  NotificationSettings,
  NotificationType,
  OtherTimingNotifications,
} from "@/types/notification";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { notificationKey } from "@/utils/firedPrayerGuard";
import { cancelAllScheduledNotifications, scheduleNotification } from "@/utils/notifications";
import { cancelAllAlerts, scheduleAllNotifications } from "@/utils/notificationScheduler";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  PermissionStatus: { GRANTED: "granted" },
  getNotificationChannelsAsync: jest.fn(() => Promise.resolve([])),
  deleteNotificationChannelAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));
jest.mock("@/utils/notifications", () => ({
  checkPermissions: jest.fn(() => Promise.resolve({ status: "granted" })),
  cancelAllScheduledNotifications: jest.fn(),
  scheduleNotification: jest.fn(() => Promise.resolve({ success: true })),
  scheduleRecurringNotification: jest.fn(() => Promise.resolve({ success: true })),
}));
jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  scheduleAthan: jest.fn(),
  cancelAllAthans: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("@/utils/qadaNotificationScheduler", () => ({ scheduleQadaNotifications: jest.fn() }));
jest.mock("@/stores/customSounds", () => ({
  useCustomSoundsStore: { getState: () => ({ customSounds: [] }) },
}));
jest.mock("@/stores/quranReminders", () => ({
  useQuranRemindersStore: { getState: () => ({ reminders: [] }) },
}));
// Number formatting reads the locale from the app store, which opens SQLite.
jest.mock("@/stores/app", () => ({
  __esModule: true,
  default: { getState: () => ({ locale: "en" }) },
}));
// The sound helpers reach the athkar store, which opens SQLite.
jest.mock("@/stores/athkar", () => ({ useAthkarStore: { getState: jest.fn() } }));
jest.mock("@/utils/customSoundManager", () => ({
  isCustomSoundKey: () => false,
  createChannelWithCustomSound: jest.fn(),
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));
jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);
jest.mock("@/utils/notificationChannels", () => ({
  createNotificationChannels: jest.fn(),
  getNotificationChannelId: () => "test-channel",
}));

// The process zone as the place's zone; the zone tests pass their own.
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
// UTC+14 and UTC−11: ahead of and behind any process zone a test runs in.
const AHEAD_ZONE = "Pacific/Kiritimati";
const BEHIND_ZONE = "Pacific/Pago_Pago";
const SETTINGS: NotificationSettings = {
  enabled: true,
  defaults: {
    prayer: { enabled: true, sound: "makkahAthan1", vibration: true },
    iqama: { enabled: true, sound: "iqama1", vibration: true, timing: 10 },
    preAthan: { enabled: true, sound: "tasbih", vibration: true, timing: 15 },
    qada: { enabled: false, sound: "tasbih", vibration: true },
  },
  overrides: {},
};
const withIqamaAfter = (timing: number): NotificationSettings => ({
  ...SETTINGS,
  defaults: { ...SETTINGS.defaults, iqama: { ...SETTINGS.defaults.iqama, timing } },
});
const withPreAthanBefore = (timing: number): NotificationSettings => ({
  ...SETTINGS,
  defaults: { ...SETTINGS.defaults, preAthan: { ...SETTINGS.defaults.preAthan, timing } },
});
const ATHKAR = {
  morningNotification: { type: ATHKAR_TYPE.MORNING, enabled: false, hour: 6, minute: 0 },
  eveningNotification: { type: ATHKAR_TYPE.EVENING, enabled: false, hour: 18, minute: 0 },
};
const day = (date: number, ymd: string, maghrib: string, isha: string): DayPrayerTimes => ({
  date,
  timezone: ZONE,
  timings: {
    fajr: `${ymd}T01:40:00Z`,
    dhuhr: `${ymd}T09:00:00Z`,
    asr: `${ymd}T12:20:00Z`,
    maghrib: `${ymd}T${maghrib}:00Z`,
    isha: `${ymd}T${isha}:00Z`,
  },
  otherTimings: {} as DayPrayerTimes["otherTimings"],
});
const RIYADH = [
  day(20261026, "2026-10-26", "14:30", "16:00"),
  day(20261027, "2026-10-27", "14:29", "15:59"),
];
const JEDDAH = [
  day(20261026, "2026-10-26", "14:56", "16:26"),
  day(20261027, "2026-10-27", "14:55", "16:25"),
];
const run = (rows: DayPrayerTimes[], androidOptions = {}, settings = SETTINGS, zone = ZONE) =>
  scheduleAllNotifications(settings, ATHKAR, rows, zone, null, androidOptions);
const bookings = () =>
  jest.mocked(scheduleNotification).mock.calls.map(([date, input]) => ({
    type: input.data?.type,
    prayerId: input.data?.prayerId,
    at: date.toISOString(),
  }));
const maghribOn26 = () =>
  bookings().filter((b) => b.prayerId === "maghrib" && b.at.startsWith("2026-10-26"));
const moveAt = async (iso: string, rows: DayPrayerTimes[], androidOptions = {}, zone = ZONE) => {
  jest.setSystemTime(new Date(iso));
  jest.mocked(scheduleNotification).mockClear();
  return run(rows, androidOptions, SETTINGS, zone);
};
// The recorded instants of one alert kind for Maghrib on the 26th.
const ledgerOn26 = (type: NotificationType) =>
  readLedger(FIRED_LEDGER.NOTIFICATIONS, Date.now())
    .filter((e) => e.key === notificationKey(type, "maghrib"))
    .map((e) => new Date(e.at).toISOString())
    .filter((at) => at.startsWith("2026-10-26"));
const landed = { success: true, id: "booked" } as const;
// Imsak alone among the other timings.
const IMSAK_ONLY: OtherTimingNotifications = {
  ishraq: false,
  duha: false,
  midnight: false,
  firstthird: false,
  lastthird: false,
  imsak: true,
};
const withImsak = (row: DayPrayerTimes, imsak: string): DayPrayerTimes => ({
  ...row,
  otherTimings: { ...row.otherTimings, imsak },
});
const RIYADH_IMSAK = [
  withImsak(RIYADH[0], "2026-10-26T01:30:00Z"),
  withImsak(RIYADH[1], "2026-10-27T01:31:00Z"),
];
const JEDDAH_IMSAK = [
  withImsak(JEDDAH[0], "2026-10-26T01:56:00Z"),
  withImsak(JEDDAH[1], "2026-10-27T01:57:00Z"),
];
// Runs at iso with imsak on; returns the imsak instants that run booked.
const imsakAt = async (iso: string, rows: DayPrayerTimes[]) => {
  jest.setSystemTime(new Date(iso));
  jest.mocked(scheduleNotification).mockClear();
  await scheduleAllNotifications(SETTINGS, ATHKAR, rows, ZONE, null, {}, {}, IMSAK_ONLY);
  return bookings()
    .filter((b) => b.type === NOTIFICATION_TYPE.OTHER_TIMING && b.prayerId === "imsak")
    .map((b) => b.at);
};

beforeEach(() => {
  resetMemoryKv();
  jest.clearAllMocks();
  jest.replaceProperty(Platform, "OS", PlatformType.IOS);
  jest.useFakeTimers({ now: new Date("2026-10-26T14:00:00Z") });
});
afterEach(() => {
  jest.useRealTimers();
});

// Maghrib pre-athan, athan, iqama: Riyadh 14:15, 14:30, 14:40;
// Jeddah 14:41, 14:56, 15:06.
describe("a reschedule after a prayer's alerts fired", () => {
  it("does not book an athan or pre-athan again after a same-day move west", async () => {
    await run(RIYADH);
    await moveAt("2026-10-26T14:35:00Z", JEDDAH);
    // Riyadh's iqama had not fired, so Jeddah's is the only one.
    expect(maghribOn26()).toEqual([
      { type: NOTIFICATION_TYPE.IQAMA, prayerId: "maghrib", at: "2026-10-26T15:06:00.000Z" },
    ]);
  });

  it("books tomorrow's Maghrib after today's fired", async () => {
    await run(RIYADH);
    await moveAt("2026-10-26T14:35:00Z", JEDDAH);
    expect(bookings()).toContainEqual({
      type: NOTIFICATION_TYPE.PRAYER,
      prayerId: "maghrib",
      at: "2026-10-27T14:55:00.000Z",
    });
  });

  it("keeps a fired athan out of a second reschedule", async () => {
    await run(RIYADH);
    await moveAt("2026-10-26T14:35:00Z", JEDDAH);
    await moveAt("2026-10-26T14:50:00Z", JEDDAH);
    expect(maghribOn26().map((b) => b.type)).toEqual([NOTIFICATION_TYPE.IQAMA]);
  });

  it("a reschedule after Maghrib's athan and before its iqama books the iqama", async () => {
    await run(RIYADH);
    await moveAt("2026-10-26T14:35:00Z", RIYADH);
    expect(maghribOn26()).toEqual([
      { type: NOTIFICATION_TYPE.IQAMA, prayerId: "maghrib", at: "2026-10-26T14:40:00.000Z" },
    ]);
  });

  it("an iqama that already fired is not booked again", async () => {
    await run(RIYADH);
    // Riyadh's 14:40 iqama fired; a 20-minute iqama falls at 14:50.
    jest.setSystemTime(new Date("2026-10-26T14:45:00Z"));
    jest.mocked(scheduleNotification).mockClear();
    await run(RIYADH, {}, withIqamaAfter(20));
    expect(maghribOn26()).toEqual([]);
  });

  it("books the athan when the earlier one was cancelled before its time", async () => {
    await run(RIYADH);
    jest.setSystemTime(new Date("2026-10-26T14:10:00Z"));
    await cancelAllAlerts();
    await moveAt("2026-10-26T14:35:00Z", JEDDAH);
    expect(maghribOn26().map((b) => b.type)).toEqual([
      NOTIFICATION_TYPE.PRE_ATHAN,
      NOTIFICATION_TYPE.PRAYER,
      NOTIFICATION_TYPE.IQAMA,
    ]);
  });

  it("does not count a refused booking as fired", async () => {
    jest
      .mocked(scheduleNotification)
      .mockImplementation(async (_date, input) =>
        input.data?.type === NOTIFICATION_TYPE.PRAYER && input.data?.prayerId === "maghrib"
          ? { success: false, message: "refused" }
          : landed
      );
    await run(RIYADH);
    jest.mocked(scheduleNotification).mockImplementation(async () => landed);
    await moveAt("2026-10-26T14:35:00Z", JEDDAH);
    expect(maghribOn26()).toContainEqual({
      type: NOTIFICATION_TYPE.PRAYER,
      prayerId: "maghrib",
      at: "2026-10-26T14:56:00.000Z",
    });
  });

  it("does not count the open-the-app reminder as a fired Fajr", async () => {
    await run([RIYADH[0]]); // last item: Isha iqama 16:10, reminder 16:20
    await moveAt("2026-10-26T16:30:00Z", RIYADH);
    expect(bookings()).toContainEqual({
      type: NOTIFICATION_TYPE.PRAYER,
      prayerId: "fajr",
      at: "2026-10-27T01:40:00.000Z",
    });
  });

  it("books every alert when the ledger cannot be read", async () => {
    await run(RIYADH);
    memoryKvFailure.read = true;
    const result = await moveAt("2026-10-26T14:35:00Z", JEDDAH);
    expect(result.success).toBe(true);
    expect(maghribOn26()).toContainEqual({
      type: NOTIFICATION_TYPE.PRAYER,
      prayerId: "maghrib",
      at: "2026-10-26T14:56:00.000Z",
    });
  });

  it("keeps unfired bookings when the native athan cancel fails", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    await run(RIYADH, { fullAthanPlayback: true });
    jest.setSystemTime(new Date("2026-10-26T14:20:00Z"));
    jest.mocked(cancelAllAthans).mockResolvedValueOnce(false);
    // Riyadh's 14:30 native athan stays armed and plays.
    await cancelAllAlerts();
    await moveAt("2026-10-26T14:35:00Z", JEDDAH, { fullAthanPlayback: true });
    expect(maghribOn26().map((b) => b.type)).toEqual([NOTIFICATION_TYPE.IQAMA]);
  });

  it("records nothing for a run that another run cancelled under it", async () => {
    let release: () => void = () => {};
    jest.mocked(scheduleNotification).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(landed);
        })
    );
    // Held at its first booking, the 14:15 pre-athan; its iqama is 14:40.
    const first = run(RIYADH);
    while (jest.mocked(scheduleNotification).mock.calls.length === 0) await Promise.resolve();
    // Cancels, then books iqama 14:50.
    await run(RIYADH, {}, withIqamaAfter(20));
    release();
    await first;
    expect(ledgerOn26(NOTIFICATION_TYPE.IQAMA)).toEqual(["2026-10-26T14:50:00.000Z"]);
  });

  it("records nothing for a run whose cancel overlapped a later run's cancel", async () => {
    const cancels: (() => void)[] = [];
    const holdCancel = () => new Promise<void>((resolve) => cancels.push(resolve));
    jest
      .mocked(cancelAllScheduledNotifications)
      .mockImplementationOnce(holdCancel)
      .mockImplementationOnce(holdCancel);
    let releaseBooking: () => void = () => {};
    jest.mocked(scheduleNotification).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseBooking = () => resolve(landed);
        })
    );
    const first = run(RIYADH); // pre-athan 14:15
    const second = run(RIYADH, {}, withPreAthanBefore(10)); // pre-athan 14:20
    while (cancels.length < 2) await Promise.resolve();
    cancels[0]();
    while (jest.mocked(scheduleNotification).mock.calls.length === 0) await Promise.resolve();
    // The second cancel lands while the first run's 14:15 booking is in flight.
    cancels[1]();
    await second;
    releaseBooking();
    await first;
    expect(ledgerOn26(NOTIFICATION_TYPE.PRE_ATHAN)).toEqual(["2026-10-26T14:20:00.000Z"]);
  });

  it("books Maghrib due in 30 minutes when the place zone is not the process zone", async () => {
    // 14:00Z; the Maghrib athan is at 14:30Z.
    await run(RIYADH, {}, SETTINGS, AHEAD_ZONE);
    expect(maghribOn26()).toContainEqual({
      type: NOTIFICATION_TYPE.PRAYER,
      prayerId: "maghrib",
      at: "2026-10-26T14:30:00.000Z",
    });
  });

  it("does not book a passed athan again when the place zone is behind the process zone", async () => {
    // An empty ledger, as on the first run after an update.
    await moveAt("2026-10-26T14:35:00Z", RIYADH, {}, BEHIND_ZONE);
    // Only the 14:40 iqama is still due.
    expect(maghribOn26()).toEqual([
      { type: NOTIFICATION_TYPE.IQAMA, prayerId: "maghrib", at: "2026-10-26T14:40:00.000Z" },
    ]);
  });
});

// Imsak: Riyadh 01:30, Jeddah 01:56 on the 26th.
describe("a reschedule after another timing fired", () => {
  it("a same-day move west does not book a fired imsak again", async () => {
    await imsakAt("2026-10-26T01:00:00Z", RIYADH_IMSAK);
    expect(await imsakAt("2026-10-26T01:35:00Z", JEDDAH_IMSAK)).toEqual([
      "2026-10-27T01:57:00.000Z",
    ]);
  });

  it("books an imsak cancelled before its time", async () => {
    await imsakAt("2026-10-26T01:00:00Z", RIYADH_IMSAK);
    jest.setSystemTime(new Date("2026-10-26T01:20:00Z"));
    await cancelAllAlerts();
    expect(await imsakAt("2026-10-26T01:35:00Z", JEDDAH_IMSAK)).toEqual([
      "2026-10-26T01:56:00.000Z",
      "2026-10-27T01:57:00.000Z",
    ]);
  });
});
