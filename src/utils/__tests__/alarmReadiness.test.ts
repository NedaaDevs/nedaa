import { ALARM_PERMISSION, type AlarmPermissionId } from "@/constants/Alarm";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
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
