import fs from "fs";
import path from "path";
import { act, renderHook } from "@testing-library/react-native";

import { ScheduledAlarmType } from "@/enums/alarm";
import { useAlarmScreen } from "@/hooks/useAlarmScreen";
import { DEFAULT_VIBRATION_CONFIG, VIBRATION_PATTERNS, VibrationPattern } from "@/types/alarm";

const mockStartAlarmSound = jest.fn((_name: string) => Promise.resolve(true));
const mockCompleteAndReschedule = jest.fn((_id: string) => Promise.resolve());
const mockSnoozeAlarm = jest.fn();
const mockStopAlarmSound = jest.fn();
// Mirrors the native vibration across start, stop and stop-all; the screen
// mounts while the alarm already vibrates.
let mockNativeVibrating = true;
const mockStartAlarmVibration = jest.fn((_pattern: string) => {
  mockNativeVibrating = true;
  return true;
});
const mockStopAlarmVibration = jest.fn(() => {
  mockNativeVibrating = false;
});
const mockSettings = {
  sound: "makkahAthan1",
  volume: 1,
  snooze: { enabled: true, maxCount: 3, durationMinutes: 5 },
  vibration: { enabled: false, pattern: DEFAULT_VIBRATION_CONFIG.pattern },
  challenge: undefined,
};
// Friday allows fewer snoozes, so the count shows whose settings were read.
const mockFridaySettings = { ...mockSettings, snooze: { ...mockSettings.snooze, maxCount: 1 } };
const QUIET_STORE = { fajr: mockSettings, friday: mockFridaySettings };
let mockStoreState = QUIET_STORE;

// Two distinct patterns, so the argument shows whose settings were read.
const [FAJR_PATTERN, FRIDAY_PATTERN] = Object.keys(VIBRATION_PATTERNS) as VibrationPattern[];
const vibratingWith = (settings: typeof mockSettings, pattern: VibrationPattern) => ({
  ...settings,
  vibration: { enabled: true, pattern },
});
const VIBRATING_STORE = {
  fajr: vibratingWith(mockSettings, FAJR_PATTERN),
  friday: vibratingWith(mockFridaySettings, FRIDAY_PATTERN),
};

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Vibration: { vibrate: jest.fn(), cancel: jest.fn() },
  BackHandler: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
// The alarm constants import icons; react-native is stubbed here, so stub them too.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("expo-alarm", () => {
  const { CHALLENGE_TYPE, CHALLENGE_DIFFICULTY } = jest.requireActual("expo-alarm");
  return {
    CHALLENGE_TYPE,
    CHALLENGE_DIFFICULTY,
    isAlarmSoundPlaying: () => false,
    startAlarmSound: (name: string) => mockStartAlarmSound(name),
    setAlarmVolume: jest.fn(),
    stopAllAlarmEffects: () => {
      mockNativeVibrating = false;
    },
    restoreSystemVolume: jest.fn(),
    stopAlarmSound: () => mockStopAlarmSound(),
    stopAlarmVibration: () => mockStopAlarmVibration(),
    startAlarmVibration: (pattern: string) => mockStartAlarmVibration(pattern),
  };
});
jest.mock("@/stores/alarm", () => ({
  useAlarmStore: (select: (state: object) => unknown) =>
    select({ snoozeAlarm: mockSnoozeAlarm, scheduledAlarms: {} }),
}));
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: (select: (state: object) => unknown) => select(mockStoreState),
}));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn() } }));
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

const snoozed = () => ({
  snoozeId: SNOOZE_ID,
  snoozeEndTime: new Date(Date.now() + 5 * 60_000),
  snoozeCount: 1,
});

const mount = (alarmType: string = ScheduledAlarmType.FAJR) =>
  renderHook(() => useAlarmScreen(ALARM_ID, alarmType));

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState = QUIET_STORE;
  mockNativeVibrating = true;
});

describe("useAlarmScreen", () => {
  it("starts a sound file that the iOS bundle ships", async () => {
    await mount();

    const name = mockStartAlarmSound.mock.calls[0][0];
    expect(fs.existsSync(path.join(IOS_DIR, `${name}.caf`))).toBe(true);
  });

  it("silences the sound and the native vibration while a challenge is solved", async () => {
    const { result } = await mount();

    await act(async () => result.current.handleGraceStart());

    expect(mockStopAlarmSound).toHaveBeenCalledTimes(1);
    expect(mockStopAlarmVibration).toHaveBeenCalledTimes(1);
  });

  it.each([
    [ScheduledAlarmType.FAJR, FAJR_PATTERN],
    [ScheduledAlarmType.JUMMAH, FRIDAY_PATTERN],
    [ScheduledAlarmType.CUSTOM, FAJR_PATTERN],
  ])("restarts a %s alarm's native vibration with its pattern", async (alarmType, pattern) => {
    mockStoreState = VIBRATING_STORE;
    const { result } = await mount(alarmType);

    await act(async () => result.current.handleGraceStart());
    await act(async () => result.current.handleGraceExpire());

    expect(mockStartAlarmVibration).toHaveBeenCalledWith(pattern);
  });

  it("keeps the native vibration off after the grace time when vibration is off", async () => {
    const { result } = await mount();

    await act(async () => result.current.handleGraceStart());
    await act(async () => result.current.handleGraceExpire());

    expect(mockStartAlarmVibration).not.toHaveBeenCalled();
  });

  it("leaves no native vibration running once the challenge is solved", async () => {
    mockStoreState = VIBRATING_STORE;
    const { result } = await mount();

    await act(async () => result.current.handleGraceStart());
    await act(async () => result.current.handleGraceExpire());
    await act(async () => {
      await result.current.handleChallengeComplete();
    });

    expect(mockNativeVibrating).toBe(false);
  });

  it("does not restart the native vibration after the alarm is dismissed", async () => {
    mockStoreState = VIBRATING_STORE;
    const { result } = await mount();

    await act(async () => {
      await result.current.handleChallengeComplete();
    });
    await act(async () => result.current.handleGraceExpire());

    expect(mockStartAlarmVibration).not.toHaveBeenCalled();
  });

  it("does not restart the native vibration when the snooze succeeds", async () => {
    mockStoreState = VIBRATING_STORE;
    mockSnoozeAlarm.mockResolvedValue(snoozed());
    const { result } = await mount();

    await act(async () => result.current.handleGraceStart());
    await act(async () => {
      await result.current.handleSnooze();
    });
    await act(async () => result.current.handleGraceExpire());

    expect(mockStartAlarmVibration).not.toHaveBeenCalled();
  });

  it("restarts the native vibration when the snooze fails during the grace time", async () => {
    mockStoreState = VIBRATING_STORE;
    mockSnoozeAlarm.mockResolvedValue(null);
    const { result } = await mount();

    await act(async () => result.current.handleGraceStart());
    await act(async () => {
      await result.current.handleSnooze();
    });

    expect(mockStartAlarmVibration).toHaveBeenCalledWith(FAJR_PATTERN);
  });

  it("rings when the grace time ends after a snooze that threw", async () => {
    mockStoreState = VIBRATING_STORE;
    mockSnoozeAlarm.mockRejectedValue(new Error("cancel failed"));
    const { result } = await mount();

    await act(async () => result.current.handleGraceStart());
    await act(async () => {
      await result.current.handleSnooze();
    });
    mockStartAlarmVibration.mockClear();
    await act(async () => result.current.handleGraceStart());
    await act(async () => {
      await result.current.handleGraceExpire();
    });

    expect(mockStartAlarmVibration).toHaveBeenCalledWith(FAJR_PATTERN);
    expect(mockMarkAlarmHandled).not.toHaveBeenCalled();
  });

  it("does not ring when the grace time ends while a snooze is in flight", async () => {
    mockStoreState = VIBRATING_STORE;
    let finishSnooze!: (value: ReturnType<typeof snoozed>) => void;
    mockSnoozeAlarm.mockReturnValue(new Promise((resolve) => (finishSnooze = resolve)));
    const { result } = await mount();
    await act(async () => result.current.handleGraceStart());
    mockStartAlarmSound.mockClear();

    // Sets only refs before its await, so it needs no act() of its own.
    const snooze = result.current.handleSnooze();
    await act(async () => result.current.handleGraceExpire());
    await act(async () => {
      finishSnooze(snoozed());
      await snooze;
    });

    expect(mockStartAlarmSound).not.toHaveBeenCalled();
    expect(mockStartAlarmVibration).not.toHaveBeenCalled();
  });

  it("leaves the native vibration off when a grace time restarts during the ring", async () => {
    mockStoreState = VIBRATING_STORE;
    const { result } = await mount();
    await act(async () => result.current.handleGraceStart());
    let finishSound!: () => void;
    mockStartAlarmSound.mockImplementationOnce(
      () => new Promise((resolve) => (finishSound = () => resolve(true)))
    );

    const ring = result.current.handleGraceExpire();
    await act(async () => result.current.handleGraceStart());
    await act(async () => {
      finishSound();
      await ring;
    });

    expect(mockStartAlarmVibration).not.toHaveBeenCalled();
    expect(mockNativeVibrating).toBe(false);
  });

  it("completes the snoozed alarm, not the one it replaced", async () => {
    mockSnoozeAlarm.mockResolvedValue(snoozed());
    const { result } = await mount();

    await act(async () => {
      await result.current.handleSnooze();
    });
    await act(async () => {
      await result.current.handleChallengeComplete();
    });

    expect(mockCompleteAndReschedule).toHaveBeenCalledWith(SNOOZE_ID);
  });

  it("rings again and stays unhandled when the snooze fails", async () => {
    mockSnoozeAlarm.mockResolvedValue(null);
    const { result } = await mount();
    mockStartAlarmSound.mockClear();

    await act(async () => {
      await result.current.handleSnooze();
    });

    expect(mockStartAlarmSound).toHaveBeenCalled();
    expect(mockMarkAlarmHandled).not.toHaveBeenCalled();
  });

  it.each([
    [ScheduledAlarmType.FAJR, mockSettings],
    [ScheduledAlarmType.JUMMAH, mockFridaySettings],
    [ScheduledAlarmType.CUSTOM, mockSettings],
  ])("reads the settings that a %s alarm rings with", async (alarmType, settings) => {
    const { result } = await mount(alarmType);

    expect(result.current.remainingSnoozes).toBe(settings.snooze.maxCount);
  });
});
