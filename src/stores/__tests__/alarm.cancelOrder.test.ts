import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";

// Every native call is logged by name so the tests can read the order.
const mockCalls: string[] = [];
const mockResults: Record<string, unknown> = {};

jest.mock(
  "expo-alarm",
  () =>
    new Proxy(
      {},
      {
        get: (_target, name) => {
          if (name === "__esModule") return true;
          return (..._args: unknown[]) => {
            mockCalls.push(String(name));
            return Promise.resolve(String(name) in mockResults ? mockResults[String(name)] : true);
          };
        },
      }
    )
);

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/localization/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));
jest.mock("@/utils/alarmReport", () => ({
  alarmLog: { i: jest.fn(), w: jest.fn(), e: jest.fn() },
}));
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: { getState: () => ({ fajr: { snooze: { maxCount: 3 } } }) },
}));

const ALARM_ID = "11111111-1111-4111-8111-111111111111";

// AlarmKit reports a cancelled alerting alarm as a dismissal.
const CANCELS = ["cancelAlarm", "cancelAllBackups"];

const firstIndexOf = (names: string[]) =>
  Math.min(...names.map((name) => mockCalls.indexOf(name)).filter((i) => i >= 0));

beforeEach(async () => {
  mockCalls.length = 0;
  for (const key of Object.keys(mockResults)) delete mockResults[key];
  mockResults.getPendingChallenge = null;
  useAlarmStore.setState({ scheduledAlarms: {} });
  await useAlarmStore.getState().scheduleAlarm({
    id: ALARM_ID,
    triggerDate: new Date(Date.now() - 60_000),
    title: "Fajr",
    alarmType: ScheduledAlarmType.FAJR,
  });
  mockCalls.length = 0;
});

describe("alarm store cancel order", () => {
  it("records completion before any cancel reaches AlarmKit", async () => {
    await useAlarmStore.getState().completeAlarm(ALARM_ID);

    const firstCancel = firstIndexOf(CANCELS);
    expect(mockCalls.indexOf("markAlarmCompleted")).toBeGreaterThanOrEqual(0);
    expect(mockCalls.indexOf("markAlarmCompleted")).toBeLessThan(firstCancel);
    expect(mockCalls.indexOf("clearPendingChallenge")).toBeLessThan(firstCancel);
  });

  it("clears the pending challenge before snooze cancels the alerting alarm", async () => {
    await useAlarmStore.getState().snoozeAlarm(ALARM_ID, 5);

    expect(mockCalls.indexOf("clearPendingChallenge")).toBeGreaterThanOrEqual(0);
    expect(mockCalls.indexOf("clearPendingChallenge")).toBeLessThan(firstIndexOf(CANCELS));
  });

  // Recovery can protect an alarm with no pending challenge to clear.
  it("marks the snoozed alarm completed before any cancel", async () => {
    await useAlarmStore.getState().snoozeAlarm(ALARM_ID, 5);

    expect(mockCalls.indexOf("markAlarmCompleted")).toBeGreaterThanOrEqual(0);
    expect(mockCalls.indexOf("markAlarmCompleted")).toBeLessThan(firstIndexOf(CANCELS));
  });

  it("schedules the snooze before removing the alarm it replaces", async () => {
    await useAlarmStore.getState().snoozeAlarm(ALARM_ID, 5);

    expect(mockCalls.indexOf("scheduleAlarm")).toBeGreaterThanOrEqual(0);
    expect(mockCalls.indexOf("scheduleAlarm")).toBeLessThan(firstIndexOf(CANCELS));
  });

  it("leaves the alarm armed and unsolved when the snooze cannot be scheduled", async () => {
    mockResults.scheduleAlarm = false;

    const result = await useAlarmStore.getState().snoozeAlarm(ALARM_ID, 5);

    expect(result).toBeNull();
    for (const call of [...CANCELS, "markAlarmCompleted", "clearPendingChallenge"]) {
      expect(mockCalls).not.toContain(call);
    }
    expect(useAlarmStore.getState().scheduledAlarms[ALARM_ID]).toBeDefined();
  });

  it("still cancels the alarm and its backups", async () => {
    await useAlarmStore.getState().completeAlarm(ALARM_ID);

    expect(mockCalls).toEqual(expect.arrayContaining(CANCELS));
  });

  it("keeps an alarm it could not cancel, and reports the failure", async () => {
    mockResults.cancelAlarm = false;

    const cancelled = await useAlarmStore.getState().cancelAlarmsByType(ScheduledAlarmType.FAJR);

    expect(cancelled).toBe(false);
    expect(mockCalls).not.toContain("deleteAlarmFromDB");
    expect(useAlarmStore.getState().scheduledAlarms[ALARM_ID]).toBeDefined();
  });

  it("leaves another alarm's ringing and challenge alone", async () => {
    mockResults.getPendingChallenge = {
      alarmId: "other",
      alarmType: "fajr",
      title: "",
      timestamp: 0,
    };

    await useAlarmStore.getState().completeAlarm(ALARM_ID);

    for (const call of [
      "stopAllAlarmEffects",
      "clearPendingChallenge",
      "cancelAllBackups",
      "endAllLiveActivities",
    ]) {
      expect(mockCalls).not.toContain(call);
    }
    expect(mockCalls).toEqual(expect.arrayContaining(["markAlarmCompleted", "cancelAlarm"]));
  });
});
