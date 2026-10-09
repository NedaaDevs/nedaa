import fs from "fs";
import path from "path";
import React, { act } from "react";
import renderer from "react-test-renderer";

import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmScreen } from "@/hooks/useAlarmScreen";

const mockStartAlarmSound = jest.fn((_name: string) => Promise.resolve(true));
const mockCompleteAndReschedule = jest.fn((_id: string) => Promise.resolve());
const mockSnoozeAlarm = jest.fn();
const mockSettings = {
  sound: "makkahAthan1",
  volume: 1,
  snooze: { enabled: true, maxCount: 3, durationMinutes: 5 },
  vibration: { enabled: false, pattern: "default" },
  challenge: undefined,
};

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Vibration: { vibrate: jest.fn(), cancel: jest.fn() },
  BackHandler: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("expo-alarm", () => ({
  isAlarmSoundPlaying: () => false,
  startAlarmSound: (name: string) => mockStartAlarmSound(name),
  setAlarmVolume: jest.fn(),
  stopAllAlarmEffects: jest.fn(),
  restoreSystemVolume: jest.fn(),
  stopAlarmSound: jest.fn(),
}));
jest.mock("@/stores/alarm", () => ({
  useAlarmStore: (select: (state: object) => unknown) =>
    select({ snoozeAlarm: mockSnoozeAlarm, scheduledAlarms: {} }),
}));
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: (select: (state: object) => unknown) =>
    select({ fajr: mockSettings, friday: mockSettings }),
}));
jest.mock("@/utils/alarmScheduler", () => ({
  completeAndRescheduleAlarm: (id: string) => mockCompleteAndReschedule(id),
}));
const mockMarkAlarmHandled = jest.fn();
jest.mock("@/hooks/useAlarmDeepLink", () => ({
  markAlarmHandled: (id: string) => mockMarkAlarmHandled(id),
  isAlarmHandled: () => false,
  setAlarmScreenActive: jest.fn(),
}));

const ALARM_ID = "11111111-1111-4111-8111-111111111111";
const SNOOZE_ID = "22222222-2222-4222-8222-222222222222";
const IOS_DIR = path.join(__dirname, "../../../ios");

const renders: ReturnType<typeof useAlarmScreen>[] = [];
const latest = () => renders[renders.length - 1];
const Probe = () => {
  renders.push(useAlarmScreen(ALARM_ID, ScheduledAlarmType.FAJR));
  return null;
};

const mount = async () => {
  await act(async () => {
    renderer.create(<Probe />);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  renders.length = 0;
});

describe("useAlarmScreen", () => {
  it("starts a sound file that the iOS bundle ships", async () => {
    await mount();

    const name = mockStartAlarmSound.mock.calls[0][0];
    expect(fs.existsSync(path.join(IOS_DIR, `${name}.caf`))).toBe(true);
  });

  it("completes the snoozed alarm, not the one it replaced", async () => {
    mockSnoozeAlarm.mockResolvedValue({
      snoozeId: SNOOZE_ID,
      snoozeEndTime: new Date(Date.now() + 5 * 60_000),
      snoozeCount: 1,
    });
    await mount();

    await act(async () => {
      await latest().handleSnooze();
    });
    await act(async () => {
      await latest().handleChallengeComplete();
    });

    expect(mockCompleteAndReschedule).toHaveBeenCalledWith(SNOOZE_ID);
  });

  it("rings again and stays unhandled when the snooze fails", async () => {
    mockSnoozeAlarm.mockResolvedValue(null);
    await mount();
    mockStartAlarmSound.mockClear();

    await act(async () => {
      await latest().handleSnooze();
    });

    expect(mockStartAlarmSound).toHaveBeenCalled();
    expect(mockMarkAlarmHandled).not.toHaveBeenCalled();
  });
});
