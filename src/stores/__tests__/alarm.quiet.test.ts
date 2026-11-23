import { LIVE_ACTIVITY_STATE } from "@/constants/Alarm";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore } from "@/stores/alarm";

// Every native call is logged by name, with its arguments, in order.
const mockCalls: { name: string; args: unknown[] }[] = [];
const mockResults: Record<string, unknown> = {};

jest.mock(
  "expo-alarm",
  () =>
    new Proxy(
      {},
      {
        get: (_target, name) => {
          if (name === "__esModule") return true;
          return (...args: unknown[]) => {
            mockCalls.push({ name: String(name), args });
            const result = String(name) in mockResults ? mockResults[String(name)] : true;
            return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
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
jest.mock("@/stores/alarmSettings", () => {
  const { ALARM_TYPE } = jest.requireActual("@/constants/Alarm");
  return {
    useAlarmSettingsStore: {
      getState: () => ({ [ALARM_TYPE.FAJR]: { snooze: { maxCount: 3 } } }),
    },
  };
});

const ALARM_ID = "11111111-1111-4111-8111-111111111111";
const RINGS_AT = new Date(Date.now() + 5 * 60_000);
const RECORD = "recordUse";
const SILENCE = "silence";

const names = () => mockCalls.map(({ name }) => name);
const indexOf = (name: string) => names().indexOf(name);
const firstCancel = () =>
  Math.min(...["cancelAlarm", "cancelAllBackups"].map(indexOf).filter((i) => i >= 0));

const recordUse = jest.fn(() => {
  mockCalls.push({ name: RECORD, args: [] });
});
const silence = jest.fn(() => {
  mockCalls.push({ name: SILENCE, args: [] });
});

const quiet = () =>
  useAlarmStore.getState().quietAlarm(ALARM_ID, { ringsAt: RINGS_AT, recordUse, silence });

beforeEach(async () => {
  mockCalls.length = 0;
  for (const key of Object.keys(mockResults)) delete mockResults[key];
  mockResults.getPendingChallenge = null;
  recordUse.mockClear();
  silence.mockClear();
  useAlarmStore.setState({ scheduledAlarms: {} });
  await useAlarmStore.getState().scheduleAlarm({
    id: ALARM_ID,
    triggerDate: new Date(Date.now() - 60_000),
    title: "Fajr",
    alarmType: ScheduledAlarmType.FAJR,
    snoozeCount: 1,
  });
  mockCalls.length = 0;
});

describe("an emergency quiet", () => {
  it("arms the re-ring, then counts the use, then silences", async () => {
    const result = await quiet();

    expect(result).not.toBeNull();
    expect(indexOf("scheduleAlarm")).toBe(0);
    expect(indexOf(RECORD)).toBeGreaterThan(indexOf("scheduleAlarm"));
    expect(indexOf(SILENCE)).toBeGreaterThan(indexOf(RECORD));
    expect(indexOf("stopAllAlarmEffects")).toBeGreaterThan(indexOf(RECORD));
  });

  it("marks the quieted alarm completed and clears its challenge before any cancel", async () => {
    await quiet();

    expect(indexOf("markAlarmCompleted")).toBeLessThan(firstCancel());
    expect(indexOf("clearPendingChallenge")).toBeLessThan(firstCancel());
    expect(indexOf("markAlarmCompleted")).toBeGreaterThan(indexOf(RECORD));
  });

  it("replaces the alarm with one that rings again at full sound, already quieted", async () => {
    const result = await quiet();
    const { scheduledAlarms } = useAlarmStore.getState();

    expect(scheduledAlarms[ALARM_ID]).toBeUndefined();
    expect(result?.ringsAt).toEqual(RINGS_AT);
    expect(scheduledAlarms[result?.quietId ?? ""]).toMatchObject({
      alarmType: ScheduledAlarmType.FAJR,
      title: "Fajr",
      triggerTime: RINGS_AT.getTime(),
      snoozeCount: 1,
      quietUsed: true,
    });
  });

  it("shows the wait on the lock screen with no buttons", async () => {
    const result = await quiet();
    const activity = mockCalls.find(({ name }) => name === "startLiveActivity");

    expect(activity?.args[0]).toMatchObject({
      alarmId: result?.quietId,
      state: LIVE_ACTIVITY_STATE.COUNTDOWN,
    });
  });

  it("keeps ringing and counts nothing when the re-ring cannot be armed", async () => {
    mockResults.scheduleAlarm = false;

    expect(await quiet()).toBeNull();
    expect(recordUse).not.toHaveBeenCalled();
    expect(silence).not.toHaveBeenCalled();
    expect(names()).not.toContain("stopAllAlarmEffects");
    expect(names()).not.toContain("markAlarmCompleted");
    expect(useAlarmStore.getState().scheduledAlarms[ALARM_ID]).toBeDefined();
  });

  it("disarms the re-ring and keeps ringing when the use cannot be counted", async () => {
    recordUse.mockImplementationOnce(() => {
      throw new Error("none left");
    });

    expect(await quiet()).toBeNull();
    const scheduled = mockCalls.find(({ name }) => name === "scheduleAlarm");
    const quietId = (scheduled?.args[0] as { id: string }).id;
    expect(mockCalls).toContainEqual({ name: "cancelAlarm", args: [quietId] });
    expect(silence).not.toHaveBeenCalled();
    expect(names()).not.toContain("stopAllAlarmEffects");
    expect(names()).not.toContain("markAlarmCompleted");
    expect(Object.keys(useAlarmStore.getState().scheduledAlarms)).toEqual([ALARM_ID]);
  });

  it("keeps the re-ring's record when its disarm is refused", async () => {
    mockResults.cancelAlarm = false;
    recordUse.mockImplementationOnce(() => {
      throw new Error("none left");
    });

    expect(await quiet()).toBeNull();
    const scheduled = mockCalls.find(({ name }) => name === "scheduleAlarm");
    const quietId = (scheduled?.args[0] as { id: string }).id;
    expect(useAlarmStore.getState().scheduledAlarms[quietId]).toBeDefined();
    expect(names()).not.toContain("deleteAlarmFromDB");
  });

  it("disarms the re-ring and counts nothing when the alarm ended while it armed", async () => {
    const quieting = quiet();
    useAlarmStore.setState({ scheduledAlarms: {} });

    expect(await quieting).toBeNull();
    expect(recordUse).not.toHaveBeenCalled();
    expect(silence).not.toHaveBeenCalled();
    expect(names()).not.toContain("markAlarmCompleted");
  });

  it("leaves another alarm's challenge and backups alone", async () => {
    mockResults.getPendingChallenge = { alarmId: "other" };

    const result = await quiet();

    expect(result).not.toBeNull();
    expect(names()).not.toContain("clearPendingChallenge");
    expect(names()).not.toContain("cancelAllBackups");
    expect(mockCalls).toContainEqual({ name: "markAlarmCompleted", args: [ALARM_ID] });
    expect(mockCalls).toContainEqual({ name: "cancelAlarm", args: [ALARM_ID] });
  });

  it("still cancels the backups and drops the record when the cancel throws", async () => {
    mockResults.cancelAlarm = new Error("native cancel failed");

    const result = await quiet();

    expect(result).not.toBeNull();
    expect(names()).toContain("cancelAllBackups");
    expect(useAlarmStore.getState().scheduledAlarms[ALARM_ID]).toBeUndefined();
  });

  it("does nothing for an alarm it has no record of", async () => {
    expect(
      await useAlarmStore
        .getState()
        .quietAlarm("missing", { ringsAt: RINGS_AT, recordUse, silence })
    ).toBeNull();
    expect(mockCalls).toEqual([]);
    expect(recordUse).not.toHaveBeenCalled();
  });

  it("carries the quiet through a later snooze, as the same alarm", async () => {
    const quieted = await quiet();
    const snoozed = await useAlarmStore.getState().snoozeAlarm(quieted?.quietId ?? "", 5);

    expect(useAlarmStore.getState().scheduledAlarms[snoozed?.snoozeId ?? ""]?.quietUsed).toBe(true);
  });

  it("keeps the first ring's trigger through a quiet and a later snooze", async () => {
    const firstRing = useAlarmStore.getState().scheduledAlarms[ALARM_ID].triggerTime;
    const quieted = await quiet();
    const snoozed = await useAlarmStore.getState().snoozeAlarm(quieted?.quietId ?? "", 5);
    const { scheduledAlarms } = useAlarmStore.getState();

    expect(scheduledAlarms[snoozed?.snoozeId ?? ""]?.firstTriggerTime).toBe(firstRing);
  });

  it("keeps the first ring's trigger through a snooze", async () => {
    const firstRing = useAlarmStore.getState().scheduledAlarms[ALARM_ID].triggerTime;
    const snoozed = await useAlarmStore.getState().snoozeAlarm(ALARM_ID, 5);
    const { scheduledAlarms } = useAlarmStore.getState();

    expect(scheduledAlarms[snoozed?.snoozeId ?? ""]?.firstTriggerTime).toBe(firstRing);
  });

  it("leaves a snooze of an unquieted alarm unquieted", async () => {
    const snoozed = await useAlarmStore.getState().snoozeAlarm(ALARM_ID, 5);

    expect(useAlarmStore.getState().scheduledAlarms[snoozed?.snoozeId ?? ""]?.quietUsed).toBe(
      undefined
    );
  });
});
