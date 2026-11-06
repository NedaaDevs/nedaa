import {
  ALARM_HYDRATION_TIMEOUT_MS,
  ALARM_PERMISSION,
  type AlarmPermissionId,
} from "@/constants/Alarm";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { holdHydration } from "@/test-helpers/hydration";
import { readAlarmPermissions, type AlarmPermission } from "@/utils/alarmPermissions";
import { canTurnOnAlarm } from "@/utils/alarmReadiness";

jest.mock("@/utils/alarmPermissions", () => ({
  ...jest.requireActual("@/utils/alarmPermissions"),
  readAlarmPermissions: jest.fn(),
}));

const read = jest.mocked(readAlarmPermissions);
const {
  NOTIFICATIONS: N,
  EXACT_ALARM: E,
  FULL_SCREEN: F,
  OVERLAY: O,
  BATTERY: B,
} = ALARM_PERMISSION;

/** An Android device's items, these ones still missing. */
const missing = (...ids: AlarmPermissionId[]) =>
  read.mockResolvedValue(
    [N, E, F, O, B].map((id): AlarmPermission => ({
      id,
      granted: !ids.includes(id),
      canRequestInApp: false,
    }))
  );

beforeEach(() => {
  read.mockReset();
  usePrayerTimesStore.setState({ usingDefaultLocation: false });
});

describe("canTurnOnAlarm", () => {
  it("is true at a verified place with every item granted", async () => {
    missing();
    await expect(canTurnOnAlarm()).resolves.toBe(true);
  });

  // The alarm would ring at the default location's times, not the user's.
  it("is false at the default location's times, before any read", async () => {
    usePrayerTimesStore.setState({ usingDefaultLocation: true });
    missing();

    await expect(canTurnOnAlarm()).resolves.toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it("waits for the stored place to load", async () => {
    const held = holdHydration(useLocationStore);
    try {
      missing();
      const ready = canTurnOnAlarm();
      held.land();

      await expect(ready).resolves.toBe(true);
    } finally {
      held.restore();
    }
  });

  // Fail closed: a place that never loads is not a verified one.
  it("is false when the stored place misses the load cap, before any read", async () => {
    jest.useFakeTimers();
    const held = holdHydration(useLocationStore);
    try {
      missing();
      const ready = canTurnOnAlarm();
      await jest.advanceTimersByTimeAsync(ALARM_HYDRATION_TIMEOUT_MS);

      await expect(ready).resolves.toBe(false);
      expect(read).not.toHaveBeenCalled();
    } finally {
      held.restore();
      jest.useRealTimers();
    }
  });

  it("is false while a needed item is missing", async () => {
    missing(E);
    await expect(canTurnOnAlarm()).resolves.toBe(false);
  });

  it("is true with only improvements missing", async () => {
    missing(F, O, B);
    await expect(canTurnOnAlarm()).resolves.toBe(true);
  });

  it("is false when the read throws", async () => {
    read.mockRejectedValue(new Error("alarm module down"));
    await expect(canTurnOnAlarm()).resolves.toBe(false);
  });
});
