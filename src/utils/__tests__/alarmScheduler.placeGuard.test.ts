import { addDays } from "date-fns";

import { ALARM_DEFAULTS, ALARM_HYDRATION_TIMEOUT_MS, ALARM_TYPE } from "@/constants/Alarm";
import { TIMES_PLACE } from "@/constants/Location";
import { PRAYER_ID } from "@/constants/Prayer";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmStore, type ScheduledAlarm } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { holdHydration } from "@/test-helpers/hydration";
import { later, until } from "@/test-helpers/promises";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { alarmLog } from "@/utils/alarmReport";
import {
  ensureAlarmsScheduled,
  rescheduleAllAlarms,
  scheduleFajrAlarm,
  scheduleFridayAlarm,
  schedulePrayerAlarm,
  schedulePreviewAlarm,
} from "@/utils/alarmScheduler";

// The load publishes to widgets when it ends; widgets are not under test here.
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));

const ZONE = "UTC";
// A Wednesday noon: Fajr is next tomorrow, Jumuah on Friday.
const NOW = new Date("2026-10-14T12:00:00Z");

/** A stored day `offset` days from NOW, Fajr at 04:00 and Dhuhr at noon. */
const day = (offset: number): DayPrayerTimes => {
  const date = addDays(NOW, offset);
  const at = (hour: number) => {
    const time = new Date(date);
    time.setUTCHours(hour, 0, 0, 0);
    return time.toISOString();
  };
  return {
    date: Number(date.toISOString().slice(0, 10).replaceAll("-", "")),
    timezone: ZONE,
    timings: {
      [PRAYER_ID.FAJR]: at(4),
      [PRAYER_ID.DHUHR]: at(12),
      [PRAYER_ID.ASR]: at(15),
      [PRAYER_ID.MAGHRIB]: at(18),
      [PRAYER_ID.ISHA]: at(19),
    },
    otherTimings: {} as DayPrayerTimes["otherTimings"],
  };
};

const WEEK = Array.from({ length: 7 }, (_, offset) => day(offset));

const mockSchedule = jest.fn(async (_params: object) => true);
/** Drops the type's records, as the store's own cancel does. */
const mockCancel = jest.fn(async (type: ScheduledAlarmType) => {
  const kept = Object.entries(useAlarmStore.getState().scheduledAlarms).filter(
    ([, alarm]) => alarm.alarmType !== type
  );
  useAlarmStore.setState({ scheduledAlarms: Object.fromEntries(kept) });
  return true;
});

const COORDS = { latitude: 21.42, longitude: 39.83 };
const HOUR_MS = 60 * 60 * 1000;

/** A Fajr and a Jummah record, as an earlier schedule left them. */
const armBoth = (triggerTime = NOW.getTime() + HOUR_MS) => {
  const record = (alarmType: ScheduledAlarmType): ScheduledAlarm => ({
    alarmId: alarmType,
    alarmType,
    title: alarmType,
    triggerTime,
    liveActivityId: null,
    snoozeCount: 0,
  });
  const fajr = record(ScheduledAlarmType.FAJR);
  const jummah = record(ScheduledAlarmType.JUMMAH);
  useAlarmStore.setState({ scheduledAlarms: { [fajr.alarmId]: fajr, [jummah.alarmId]: jummah } });
};
const armedTypes = () =>
  Object.values(useAlarmStore.getState().scheduledAlarms).map(({ alarmType }) => alarmType);
const enabledBoth = () =>
  [ALARM_TYPE.FAJR, ALARM_TYPE.FRIDAY].map(
    (type) => useAlarmSettingsStore.getState()[type].enabled
  );

/** Future times stored; `usingDefaultLocation` says whose they are. */
const storeTimes = (usingDefaultLocation: boolean) =>
  usePrayerTimesStore.setState({
    usingDefaultLocation,
    todayTimings: WEEK[0],
    tomorrowTimings: WEEK[1],
    twoWeeksTimings: WEEK,
  });
const scheduledTypes = () =>
  new Set(mockSchedule.mock.calls.map(([params]) => (params as { alarmType: string }).alarmType));

let warn: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockSchedule.mockClear();
  mockCancel.mockClear();
  useAlarmStore.setState({
    scheduledAlarms: {},
    scheduleAlarm: mockSchedule,
    cancelAlarmsByType: mockCancel,
  });
  const settings = useAlarmSettingsStore.getInitialState();
  useAlarmSettingsStore.setState({
    [ALARM_TYPE.FAJR]: { ...settings[ALARM_TYPE.FAJR], enabled: true },
    [ALARM_TYPE.FRIDAY]: { ...settings[ALARM_TYPE.FRIDAY], enabled: true },
  });
  useLocationStore.setState({ lastKnownCoords: null });
  warn = jest.spyOn(alarmLog, "w").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  jest.useRealTimers();
});

const ARMING: [string, () => Promise<string | null>][] = [
  ["scheduleFajrAlarm", scheduleFajrAlarm],
  ["scheduleFridayAlarm", scheduleFridayAlarm],
  ["schedulePrayerAlarm", () => schedulePrayerAlarm(PRAYER_ID.FAJR, ScheduledAlarmType.FAJR)],
];

describe("at the default location's times", () => {
  beforeEach(() => storeTimes(true));

  it.each(ARMING)("%s arms nothing and returns null", async (_name, arm) => {
    await expect(arm()).resolves.toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("says why in the alarm log", async () => {
    await scheduleFajrAlarm();

    expect(warn).toHaveBeenCalledWith(
      "Scheduler",
      `${ScheduledAlarmType.FAJR}: place ${TIMES_PLACE.DEFAULT}, not verified — alarm not scheduled`
    );
  });

  it("ensureAlarmsScheduled arms nothing", async () => {
    await ensureAlarmsScheduled();

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  // An alarm at the fallback times is wrong, so a reschedule only cancels.
  it("rescheduleAllAlarms cancels and arms nothing", async () => {
    await rescheduleAllAlarms();

    expect(mockCancel.mock.calls).toEqual([[ScheduledAlarmType.FAJR], [ScheduledAlarmType.JUMMAH]]);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  // A rehearsal a few seconds out reads no prayer time.
  it("schedulePreviewAlarm still arms", async () => {
    await expect(schedulePreviewAlarm(ScheduledAlarmType.FAJR)).resolves.not.toBeNull();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });
});

describe("at a verified place's times", () => {
  beforeEach(() => storeTimes(false));

  it.each(ARMING)("%s arms", async (_name, arm) => {
    await expect(arm()).resolves.not.toBeNull();
    expect(mockSchedule).toHaveBeenCalled();
  });

  it("ensureAlarmsScheduled arms both alarms", async () => {
    await ensureAlarmsScheduled();

    const types = mockSchedule.mock.calls.map(
      ([params]) => (params as { alarmType: string }).alarmType
    );
    expect(new Set(types)).toEqual(new Set([ScheduledAlarmType.FAJR, ScheduledAlarmType.JUMMAH]));
  });

  it("rescheduleAllAlarms cancels, then arms both alarms again", async () => {
    await rescheduleAllAlarms();

    expect(mockCancel).toHaveBeenCalledTimes(2);
    const types = mockSchedule.mock.calls.map(
      ([params]) => (params as { alarmType: string }).alarmType
    );
    expect(new Set(types)).toEqual(new Set([ScheduledAlarmType.FAJR, ScheduledAlarmType.JUMMAH]));
  });

  it("schedulePreviewAlarm arms", async () => {
    await expect(schedulePreviewAlarm(ScheduledAlarmType.FAJR)).resolves.not.toBeNull();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });
});

// A record past the stale limit never rings, so its type counts as unarmed.
describe("a stored record at a verified place's times", () => {
  const STALE_AT = NOW.getTime() - ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS - 1;
  beforeEach(() => storeTimes(false));

  it("past the stale limit, lets ensureAlarmsScheduled arm the next occurrence", async () => {
    armBoth(STALE_AT);

    await ensureAlarmsScheduled();

    expect(scheduledTypes()).toEqual(new Set([ScheduledAlarmType.FAJR, ScheduledAlarmType.JUMMAH]));
  });

  it.each([
    ["still ahead", NOW.getTime() + HOUR_MS],
    ["due an hour ago", NOW.getTime() - HOUR_MS],
    ["exactly at the stale limit", NOW.getTime() - ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS],
  ])("%s, keeps ensureAlarmsScheduled from arming another", async (_name, triggerTime) => {
    armBoth(triggerTime);

    await ensureAlarmsScheduled();

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  // Two occurrences are armed; the second still rings once the first is stale.
  it("past the stale limit beside a later one, arms nothing", async () => {
    armBoth(STALE_AT);
    const { scheduledAlarms } = useAlarmStore.getState();
    const following = Object.values(scheduledAlarms).map((alarm) => ({
      ...alarm,
      alarmId: `${alarm.alarmId}-following`,
      triggerTime: NOW.getTime() + HOUR_MS,
    }));
    useAlarmStore.setState({
      scheduledAlarms: {
        ...scheduledAlarms,
        ...Object.fromEntries(following.map((alarm) => [alarm.alarmId, alarm])),
      },
    });

    await ensureAlarmsScheduled();

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  // A rehearsal rings once for practice; the real alarm still needs arming.
  it("a pending rehearsal, lets ensureAlarmsScheduled arm the real alarm", async () => {
    const rehearsal: ScheduledAlarm = {
      alarmId: "fajr-rehearsal",
      alarmType: ScheduledAlarmType.FAJR,
      title: ScheduledAlarmType.FAJR,
      triggerTime: NOW.getTime() + 30 * 1000,
      liveActivityId: null,
      snoozeCount: 0,
      isPreview: true,
    };
    useAlarmStore.setState({ scheduledAlarms: { [rehearsal.alarmId]: rehearsal } });

    await ensureAlarmsScheduled();

    expect(scheduledTypes()).toContain(ScheduledAlarmType.FAJR);
  });
});

// The stored switch stays on, so the launch or foreground top-up arms it.
describe("a city landing after the alarm was turned on", () => {
  it("lets ensureAlarmsScheduled arm the alarm it refused before", async () => {
    storeTimes(true);
    await ensureAlarmsScheduled();
    expect(mockSchedule).not.toHaveBeenCalled();

    usePrayerTimesStore.setState({ usingDefaultLocation: false });
    await ensureAlarmsScheduled();

    const types = mockSchedule.mock.calls.map(
      ([params]) => (params as { alarmType: string }).alarmType
    );
    expect(new Set(types)).toEqual(new Set([ScheduledAlarmType.FAJR, ScheduledAlarmType.JUMMAH]));
  });
});

// Both stores load from disk; until both have, the place is not known.
describe("before the stores load", () => {
  let held: ReturnType<typeof holdHydration>;
  beforeEach(() => {
    storeTimes(false);
    held = holdHydration(usePrayerTimesStore);
  });
  afterEach(() => held.restore());

  it.each(ARMING)("%s arms nothing when a store misses the cap", async (_name, arm) => {
    const armed = arm();
    await jest.advanceTimersByTimeAsync(ALARM_HYDRATION_TIMEOUT_MS);

    await expect(armed).resolves.toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("ensureAlarmsScheduled arms and cancels nothing when a store misses the cap", async () => {
    armBoth();
    const run = ensureAlarmsScheduled();
    await jest.advanceTimersByTimeAsync(ALARM_HYDRATION_TIMEOUT_MS);
    await run;

    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  // The times are read once loaded, not before.
  it.each(ARMING)("%s arms at the times that land with the store", async (_name, arm) => {
    usePrayerTimesStore.setState({
      todayTimings: null,
      tomorrowTimings: null,
      twoWeeksTimings: null,
    });
    const armed = arm();
    storeTimes(false);
    held.land();

    await expect(armed).resolves.not.toBeNull();
    expect(mockSchedule).toHaveBeenCalled();
  });
});

// The flag alone is not the place: the coordinates must be saved too.
// The flag marks the times as the user's; a place cleared since keeps them.
describe("under a verified flag with no saved coordinates", () => {
  beforeEach(() => storeTimes(false));

  it.each(ARMING)("%s arms", async (_name, arm) => {
    await expect(arm()).resolves.not.toBeNull();
    expect(mockSchedule).toHaveBeenCalled();
  });

  it("ensureAlarmsScheduled arms both and cancels nothing", async () => {
    await ensureAlarmsScheduled();

    expect(scheduledTypes()).toEqual(new Set([ScheduledAlarmType.FAJR, ScheduledAlarmType.JUMMAH]));
    expect(mockCancel).not.toHaveBeenCalled();
  });
});

// An alarm armed before the place dropped would ring at the wrong hour.
describe("alarms armed before the place became the default one", () => {
  beforeEach(() => {
    storeTimes(true);
    armBoth();
  });

  it("are cancelled by the top-up, and stay on as the user's choice", async () => {
    await ensureAlarmsScheduled();

    expect(mockCancel.mock.calls).toEqual([[ScheduledAlarmType.FAJR], [ScheduledAlarmType.JUMMAH]]);
    expect(armedTypes()).toEqual([]);
    expect(enabledBoth()).toEqual([true, true]);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  // The flag is written from the location store, which may lag behind it.
  it("are kept while the location store still holds coordinates", async () => {
    useLocationStore.setState({ lastKnownCoords: COORDS });

    await ensureAlarmsScheduled();

    expect(mockCancel).not.toHaveBeenCalled();
    expect(armedTypes()).toHaveLength(2);
  });

  it("are kept when a store has not hydrated in time", async () => {
    const hydrated = jest.spyOn(useLocationStore.persist, "hasHydrated").mockReturnValue(false);
    const finish = jest
      .spyOn(useLocationStore.persist, "onFinishHydration")
      .mockReturnValue(() => {});
    try {
      const run = ensureAlarmsScheduled();
      await jest.advanceTimersByTimeAsync(ALARM_HYDRATION_TIMEOUT_MS);
      await run;

      expect(mockCancel).not.toHaveBeenCalled();
      expect(armedTypes()).toHaveLength(2);
      expect(warn).toHaveBeenCalledWith("Scheduler", expect.stringContaining("not hydrated"));
    } finally {
      hydrated.mockRestore();
      finish.mockRestore();
    }
  });

  it("are armed again once the place is verified", async () => {
    await ensureAlarmsScheduled();
    usePrayerTimesStore.setState({ usingDefaultLocation: false });
    useLocationStore.setState({ lastKnownCoords: COORDS });

    await ensureAlarmsScheduled();

    const types = mockSchedule.mock.calls.map(
      ([params]) => (params as { alarmType: string }).alarmType
    );
    expect(new Set(types)).toEqual(new Set([ScheduledAlarmType.FAJR, ScheduledAlarmType.JUMMAH]));
  });
});

// The default place's days stay stored until the verified place's replace them.
describe("a place verified while the default place's days are stored", () => {
  const { refreshTimingsFromDb, cleanupOldData, getAndStorePrayerTimes } =
    usePrayerTimesStore.getState();
  afterEach(() =>
    usePrayerTimesStore.setState({ refreshTimingsFromDb, cleanupOldData, getAndStorePrayerTimes })
  );

  /** Default rows for every day, a verified place, and `fetching` to fetch. */
  const verifyWhileDefaultStored = (fetching: () => Promise<boolean>) => {
    storeTimes(true);
    usePrayerTimesStore.setState({
      yesterdayTimings: day(-1),
      refreshTimingsFromDb: jest.fn(async () => WEEK),
      cleanupOldData: jest.fn(async () => true),
      getAndStorePrayerTimes: jest.fn(fetching),
    });
    useLocationStore.setState({ lastKnownCoords: COORDS });
  };
  const fetchCalls = () =>
    (usePrayerTimesStore.getState().getAndStorePrayerTimes as jest.Mock).mock.calls.length;

  it("arms nothing while its refetch runs, and arms once the days land", async () => {
    const fetch = later<boolean>();
    verifyWhileDefaultStored(() => fetch.promise);

    const load = usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();
    await until(() => fetchCalls() > 0);
    expect(fetchCalls()).toBe(1);
    await ensureAlarmsScheduled();
    expect(mockSchedule).not.toHaveBeenCalled();

    fetch.release(true);
    await load;
    await ensureAlarmsScheduled();

    const types = mockSchedule.mock.calls.map(
      ([params]) => (params as { alarmType: string }).alarmType
    );
    expect(new Set(types)).toEqual(new Set([ScheduledAlarmType.FAJR, ScheduledAlarmType.JUMMAH]));
  });

  it("arms nothing after its refetch fails", async () => {
    verifyWhileDefaultStored(async () => false);

    await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace();
    await ensureAlarmsScheduled();

    expect(fetchCalls()).toBe(1);
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
