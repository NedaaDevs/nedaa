import { Linking, Platform } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { ALARM_SCREEN_PATH, ALARM_SETTINGS_ROUTE, ALARM_TYPE } from "@/constants/Alarm";
import { PlatformType } from "@/enums/app";
import { setAlarmScreenActive, useAlarmDeepLink } from "@/hooks/useAlarmDeepLink";
import { detectActiveAlarm } from "@/utils/activeAlarmDetector";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ router: { replace: (to: unknown) => mockReplace(to) } }));
const mockCompletedIds = jest.fn(async (): Promise<string[]> => []);
jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  getCompletedAlarmIds: () => mockCompletedIds(),
}));
jest.mock("@/utils/alarmScheduler", () => ({
  completeAndRescheduleAlarm: jest.fn(),
  waitForAlarmStores: jest.fn(),
}));
jest.mock("@/utils/activeAlarmDetector", () => ({ detectActiveAlarm: jest.fn(async () => null) }));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn(), w: jest.fn() } }));

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

// Past the navigation debounce, so each case starts unguarded.
const DEBOUNCE_GAP_MS = 60_000;
let clock = Date.now();

beforeEach(() => {
  clock += DEBOUNCE_GAP_MS;
  jest.spyOn(Date, "now").mockReturnValue(clock);
  setAlarmScreenActive(null);
  jest.replaceProperty(Platform, "OS", PlatformType.IOS);
  mockReplace.mockClear();
  mockCompletedIds.mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());

describe("useAlarmDeepLink", () => {
  it("does not take a settings route that names alarms as an alarm link", async () => {
    await launchWith(link(`/${ALARM_SETTINGS_ROUTE}`));

    expect(mockReplace).not.toHaveBeenCalled();
    expect(detectActiveAlarm).not.toHaveBeenCalled();
  });

  it("does not open the alarm screen for an alarm already completed", async () => {
    mockCompletedIds.mockResolvedValue([ALARM_ID]);

    await launchWith(link(ALARM_SCREEN_PATH.RING));

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("opens the alarm screen when the completed list cannot be read", async () => {
    mockCompletedIds.mockRejectedValue(new Error("native"));

    await launchWith(link(ALARM_SCREEN_PATH.RING));

    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: ALARM_SCREEN_PATH.RING })
    );
  });

  it("routes an alarm link to the alarm screen", async () => {
    await launchWith(link(ALARM_SCREEN_PATH.RING));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: ALARM_SCREEN_PATH.RING,
      params: { alarmId: ALARM_ID, alarmType: ALARM_TYPE.FAJR },
    });
  });
});
