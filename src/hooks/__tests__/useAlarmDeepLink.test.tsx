import { Linking, Platform } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { ALARM_SCREEN_PATH, ALARM_SETTINGS_ROUTE, ALARM_TYPE } from "@/constants/Alarm";
import { PlatformType } from "@/enums/app";
import { useAlarmDeepLink } from "@/hooks/useAlarmDeepLink";
import { detectActiveAlarm } from "@/utils/activeAlarmDetector";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ router: { replace: (to: unknown) => mockReplace(to) } }));
jest.mock("expo-alarm", () => ({ ...jest.requireActual("expo-alarm") }));
jest.mock("@/utils/alarmScheduler", () => ({
  completeAndRescheduleAlarm: jest.fn(),
  waitForAlarmStores: jest.fn(),
}));
jest.mock("@/utils/activeAlarmDetector", () => ({ detectActiveAlarm: jest.fn(async () => null) }));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn() } }));

/** The scheme the native alarm module writes into its links. */
const NATIVE_ALARM_SCHEME = "dev.nedaa.app";
const ALARM_ID = "alarm-1";
const link = (path: string) =>
  `${NATIVE_ALARM_SCHEME}:/${path}?alarmId=${ALARM_ID}&alarmType=${ALARM_TYPE.FAJR}`;

const launchWith = async (url: string) => {
  jest.spyOn(Linking, "getInitialURL").mockResolvedValue(url);
  await renderHook(() => useAlarmDeepLink());
  await act(async () => undefined);
};

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", PlatformType.IOS);
  mockReplace.mockClear();
});
afterEach(() => jest.restoreAllMocks());

// The module keeps a navigation debounce, so the routing case runs last.
describe("useAlarmDeepLink", () => {
  it("does not take a settings route that names alarms as an alarm link", async () => {
    await launchWith(link(`/${ALARM_SETTINGS_ROUTE}`));

    expect(mockReplace).not.toHaveBeenCalled();
    expect(detectActiveAlarm).not.toHaveBeenCalled();
  });

  it("routes an alarm link to the alarm screen", async () => {
    await launchWith(link(ALARM_SCREEN_PATH.RING));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: ALARM_SCREEN_PATH.RING,
      params: { alarmId: ALARM_ID, alarmType: ALARM_TYPE.FAJR },
    });
  });
});
