// The Fajr step and the switch show just when the scheduler would arm it.
import { renderHook } from "@testing-library/react-native";

import { onboardingColumn } from "@/components/onboarding/column";
import { NEW_SESSION } from "@/components/onboarding/flow/types";
import {
  toColumnInput,
  type AtStart,
  type DeviceRead,
} from "@/components/onboarding/flow/useOnboardingColumn";
import { ALARM_HYDRATION_TIMEOUT_MS, ALARM_PERMISSION, ALARM_TYPE } from "@/constants/Alarm";
import { ONBOARDING_STEP } from "@/constants/Onboarding";
import { PRAYER_ID } from "@/constants/Prayer";
import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmOn } from "@/hooks/useAlarmOn";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore, type PrayerTimesStore } from "@/stores/prayerTimes";
import { armFajr, fajrRecord } from "@/test-helpers/armedAlarm";
import { holdHydration } from "@/test-helpers/hydration";
import { RIYADH_COORDS } from "@/test-helpers/prayerDay";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { readAlarmPermissions, type AlarmPermission } from "@/utils/alarmPermissions";
import { canTurnOnAlarm } from "@/utils/alarmReadiness";
import { alarmLog } from "@/utils/alarmReport";
import { ensureAlarmsScheduled, scheduleFajrAlarm } from "@/utils/alarmScheduler";
import { todayStored } from "@/utils/timesPlace";

// Every permission granted, so only the place decides.
jest.mock("@/utils/alarmPermissions", () => ({
  ...jest.requireActual("@/utils/alarmPermissions"),
  readAlarmPermissions: jest.fn(),
}));
const GRANTED: AlarmPermission[] = Object.values(ALARM_PERMISSION).map((id) => ({
  id,
  granted: true,
  canRequestInApp: false,
}));

const HOUR_MS = 60 * 60 * 1000;

/** A stored day whose prayers are all `hoursAhead` from now. */
const dayAhead = (hoursAhead: number): DayPrayerTimes => {
  const time = new Date(Date.now() + hoursAhead * HOUR_MS).toISOString();
  return {
    date: 20261014,
    timezone: "UTC",
    timings: {
      [PRAYER_ID.FAJR]: time,
      [PRAYER_ID.DHUHR]: time,
      [PRAYER_ID.ASR]: time,
      [PRAYER_ID.MAGHRIB]: time,
      [PRAYER_ID.ISHA]: time,
    },
    otherTimings: {} as DayPrayerTimes["otherTimings"],
  };
};

type TimesState = Pick<
  PrayerTimesStore,
  "usingDefaultLocation" | "todayTimings" | "tomorrowTimings" | "twoWeeksTimings"
>;

const stored = (usingDefaultLocation: boolean): TimesState => {
  const [today, tomorrow] = [dayAhead(6), dayAhead(30)];
  return {
    usingDefaultLocation,
    todayTimings: today,
    tomorrowTimings: tomorrow,
    twoWeeksTimings: [today, tomorrow],
  };
};

const nothingStored = (usingDefaultLocation: boolean): TimesState => ({
  usingDefaultLocation,
  todayTimings: null,
  tomorrowTimings: null,
  twoWeeksTimings: null,
});

// A device that can ring, before the Fajr step has turned the alarm on.
const AT_START: AtStart = {
  hasCity: true,
  deviceMode: false,
  fajrAlarmOn: false,
  fridayAlarmOn: false,
};
const DEVICE: DeviceRead = {
  location: false,
  notifications: true,
  notificationsUndetermined: false,
  alarmsSupported: true,
};

/** Both stores' facts, and whether they have loaded from disk. */
type Place = { times: TimesState; coords: typeof RIYADH_COORDS | null; loaded: boolean };

/** The call's answer, once any store wait has run out. */
const settled = async <T>(pending: Promise<T>) => {
  await jest.advanceTimersByTimeAsync(ALARM_HYDRATION_TIMEOUT_MS);
  return pending;
};

const mockSchedule = jest.fn(async (_params: object) => true);
let warn: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  mockSchedule.mockClear();
  useAlarmStore.setState({ scheduledAlarms: {}, scheduleAlarm: mockSchedule });
  useAlarmSettingsStore.setState(useAlarmSettingsStore.getInitialState());
  jest.mocked(readAlarmPermissions).mockResolvedValue(GRANTED);
  warn = jest.spyOn(alarmLog, "w").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  jest.useRealTimers();
});

describe("the Fajr alarm and the stored times", () => {
  // With no times stored a switch may turn on; the schedule then turns it off.
  it.each<[string, Place, boolean, boolean]>([
    [
      "today stored for a verified place",
      { times: stored(false), coords: RIYADH_COORDS, loaded: true },
      true,
      true,
    ],
    [
      "today stored for the default location",
      { times: stored(true), coords: null, loaded: true },
      false,
      false,
    ],
    [
      "today stored under a verified flag with no coordinates",
      { times: stored(false), coords: null, loaded: true },
      true,
      true,
    ],
    [
      "today stored with coordinates while the default flag stands",
      { times: stored(true), coords: RIYADH_COORDS, loaded: true },
      false,
      false,
    ],
    [
      "today stored for a verified place, before the stores load",
      { times: stored(false), coords: RIYADH_COORDS, loaded: false },
      false,
      false,
    ],
    [
      "nothing stored, verified place",
      { times: nothingStored(false), coords: RIYADH_COORDS, loaded: true },
      false,
      true,
    ],
    [
      "nothing stored, default location",
      { times: nothingStored(true), coords: null, loaded: true },
      false,
      false,
    ],
  ])(
    "with %s, the step is offered iff the scheduler arms it, and a switch agrees",
    async (_, { times, coords, loaded }, rings, turnsOn) => {
      usePrayerTimesStore.setState(times);
      useLocationStore.setState({ lastKnownCoords: coords });
      const held = loaded ? null : holdHydration(useLocationStore);
      try {
        const column = onboardingColumn(
          toColumnInput({
            session: NEW_SESSION,
            atStart: AT_START,
            device: DEVICE,
            todayStored: todayStored(),
          })
        );
        const canTurnOn = await settled(canTurnOnAlarm());

        // What the step does on a yes: the alarm on, then scheduled.
        useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
        const armedId = await settled(scheduleFajrAlarm());
        const { result: shown } = await renderHook(() => useAlarmOn(ALARM_TYPE.FAJR));

        const offered = column.includes(ONBOARDING_STEP.FAJR_ALARM);
        const armed = armedId !== null && mockSchedule.mock.calls.length > 0;
        expect(offered).toBe(armed);
        expect(armed).toBe(rings);
        expect(canTurnOn).toBe(turnsOn);
        // A step the column offers is one a switch could turn on too.
        expect(!offered || canTurnOn).toBe(true);
        // Nothing is armed here, so the switch reads On just where it turns on.
        expect(shown.current).toBe(canTurnOn);
      } finally {
        held?.restore();
      }
    }
  );
});

const fajrArmed = () =>
  Object.values(useAlarmStore.getState().scheduledAlarms).some(
    (alarm) => alarm.alarmType === ScheduledAlarmType.FAJR && !alarm.isPreview
  );

// The owner's rule: an alarm never rings while its switch reads Off.
describe("an alarm reads On just when it will ring", () => {
  // Only the default place cancels; a top-up arms only at a verified place.
  // Each place: whether an armed alarm stays, and whether a top-up arms one.
  const PLACES: [string, Place, boolean, boolean][] = [
    [
      "before the stores load",
      { times: stored(false), coords: RIYADH_COORDS, loaded: false },
      true,
      false,
    ],
    ["at the default place", { times: stored(true), coords: null, loaded: true }, false, false],
    [
      "with coordinates while the default times stand",
      { times: stored(true), coords: RIYADH_COORDS, loaded: true },
      true,
      false,
    ],
    [
      "at a verified place with coordinates",
      { times: stored(false), coords: RIYADH_COORDS, loaded: true },
      true,
      true,
    ],
    [
      "at a verified place with no coordinates",
      { times: stored(false), coords: null, loaded: true },
      true,
      true,
    ],
  ];
  type Row = [string, string, Place, boolean, boolean];
  const ROWS = PLACES.flatMap(([label, place, kept, toppedUp]): Row[] => [
    [label, "armed", place, true, kept],
    [label, "not armed", place, false, toppedUp],
  ]);

  beforeEach(() => {
    useAlarmStore.setState({
      scheduleAlarm: jest.fn(async ({ id, triggerDate }: { id: string; triggerDate: Date }) => {
        useAlarmStore.setState(({ scheduledAlarms }) => ({
          scheduledAlarms: { ...scheduledAlarms, [id]: fajrRecord(id, triggerDate.getTime()) },
        }));
        return true;
      }),
      cancelAlarmsByType: jest.fn(async (type: ScheduledAlarmType) => {
        const kept = Object.entries(useAlarmStore.getState().scheduledAlarms).filter(
          ([, alarm]) => alarm.alarmType !== type
        );
        useAlarmStore.setState({ scheduledAlarms: Object.fromEntries(kept) });
        return true;
      }),
    });
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
  });

  it.each(ROWS)("%s, %s", async (_, _armed, { times, coords, loaded }, armed, rings) => {
    usePrayerTimesStore.setState(times);
    useLocationStore.setState({ lastKnownCoords: coords });
    if (armed) armFajr();
    const held = loaded ? null : holdHydration(useLocationStore);
    try {
      await settled(ensureAlarmsScheduled());
      const { result: shown } = await renderHook(() => useAlarmOn(ALARM_TYPE.FAJR));

      expect(fajrArmed()).toBe(rings);
      expect(shown.current).toBe(fajrArmed());
    } finally {
      held?.restore();
    }
  });
});
