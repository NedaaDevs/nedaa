import fs from "fs";
import path from "path";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Vibration } from "react-native";
import * as ExpoAlarm from "expo-alarm";

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
const mockLogWarn = jest.fn();
jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({
      d: jest.fn(),
      i: jest.fn(),
      w: (tag: string, message: string) => mockLogWarn(tag, message),
      e: jest.fn(),
    }),
  },
}));
// The alarm constants import icons, and react-native is stubbed here,
// so the icons are stubbed too.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("expo-alarm", () => {
  const { CHALLENGE_TYPE, CHALLENGE_DIFFICULTY } = jest.requireActual("expo-alarm");
  return {
    CHALLENGE_TYPE,
    CHALLENGE_DIFFICULTY,
    isAlarmSoundPlaying: () => false,
    startAlarmSound: (name: string) => mockStartAlarmSound(name),
    setAlarmVolume: jest.fn(),
    stopAllAlarmEffects: jest.fn(() => {
      mockNativeVibrating = false;
    }),
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

/** A sound start that finishes only when the test says so. */
const holdSoundStart = () => {
  let finish: () => void = () => undefined;
  mockStartAlarmSound.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = () => resolve(true);
      })
  );
  return () => finish();
};

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

  it("silences the sound and the native vibration in quiet time", async () => {
    const { result } = await mount();

    await act(async () => result.current.handleQuietStart());

    expect(mockStopAlarmSound).toHaveBeenCalledTimes(1);
    expect(mockStopAlarmVibration).toHaveBeenCalledTimes(1);
  });

  it("logs a sound that fails to start, and keeps the screen", async () => {
    mockStartAlarmSound.mockRejectedValueOnce(new Error("no audio session"));

    const { result } = await mount();

    await waitFor(() =>
      expect(mockLogWarn).toHaveBeenCalledWith("Sound", expect.stringContaining("no audio session"))
    );
    expect(result.current.isDismissed).toBe(false);
  });

  it("rings again when quiet time ends", async () => {
    const { result } = await mount();
    mockStartAlarmSound.mockClear();

    await act(async () => result.current.handleQuietStart());
    await act(async () => result.current.handleQuietEnd());

    expect(mockStartAlarmSound).toHaveBeenCalledTimes(1);
  });

  it("keeps the native vibration off after quiet time when vibration is off", async () => {
    const { result } = await mount();

    await act(async () => result.current.handleQuietStart());
    await act(async () => result.current.handleQuietEnd());

    expect(mockStartAlarmVibration).not.toHaveBeenCalled();
  });

  it("completes the snoozed alarm, not the one it replaced", async () => {
    mockSnoozeAlarm.mockResolvedValue({
      snoozeId: SNOOZE_ID,
      snoozeEndTime: new Date(Date.now() + 5 * 60_000),
      snoozeCount: 1,
    });
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

  describe("with vibration on", () => {
    beforeEach(() => {
      mockStoreState = VIBRATING_STORE;
    });

    /** Rings again with the sound start held, and runs `during` meanwhile. */
    const ringAroundSilencing = async (during: "handleQuietStart" | "handleChallengeComplete") => {
      const { result } = await mount();
      const finishSound = holdSoundStart();
      let ringing = Promise.resolve();
      await act(async () => {
        ringing = result.current.handleQuietEnd();
      });
      await act(async () => {
        await result.current[during]();
      });
      jest.clearAllMocks();

      await act(async () => {
        finishSound();
        await ringing;
      });
    };

    it("stays silent when quiet time starts while the sound restarts", async () => {
      await ringAroundSilencing("handleQuietStart");

      expect(Vibration.vibrate).not.toHaveBeenCalled();

      expect(mockStartAlarmVibration).not.toHaveBeenCalled();
      expect(mockStopAlarmSound).toHaveBeenCalledTimes(1);
    });

    it("keeps a newer ring when an older start finishes late", async () => {
      const { result } = await mount();
      const finishSound = holdSoundStart();
      let staleRing = Promise.resolve();
      await act(async () => {
        staleRing = result.current.handleQuietEnd();
      });
      await act(async () => result.current.handleQuietStart());
      await act(async () => result.current.handleQuietEnd());
      mockStopAlarmSound.mockClear();

      await act(async () => {
        finishSound();
        await staleRing;
      });

      expect(mockStopAlarmSound).not.toHaveBeenCalled();
    });

    it("stays stopped when the alarm stops while the sound restarts", async () => {
      await ringAroundSilencing("handleChallengeComplete");

      expect(Vibration.vibrate).not.toHaveBeenCalled();

      expect(mockStartAlarmVibration).not.toHaveBeenCalled();
      expect(ExpoAlarm.stopAllAlarmEffects).toHaveBeenCalledTimes(1);
      expect(ExpoAlarm.restoreSystemVolume).toHaveBeenCalledTimes(1);
    });

    // A task opened in a snooze still ends its quiet time.
    it("stays silent when quiet time ends during a snooze", async () => {
      mockSnoozeAlarm.mockResolvedValue({
        snoozeId: SNOOZE_ID,
        snoozeEndTime: new Date(Date.now() + 5 * 60_000),
        snoozeCount: 1,
      });
      const { result } = await mount();
      await act(async () => {
        await result.current.handleSnooze();
      });
      mockStartAlarmSound.mockClear();
      jest.mocked(Vibration.vibrate).mockClear();

      await act(async () => result.current.handleQuietStart());
      await act(async () => result.current.handleQuietEnd());

      expect(mockStartAlarmSound).not.toHaveBeenCalled();
      expect(Vibration.vibrate).not.toHaveBeenCalled();
      expect(mockStartAlarmVibration).not.toHaveBeenCalled();
    });

    it.each([
      [ScheduledAlarmType.FAJR, FAJR_PATTERN],
      [ScheduledAlarmType.JUMMAH, FRIDAY_PATTERN],
      [ScheduledAlarmType.CUSTOM, FAJR_PATTERN],
    ])("restarts a %s alarm's native vibration with its pattern", async (alarmType, pattern) => {
      const { result } = await mount(alarmType);

      await act(async () => result.current.handleQuietStart());
      await act(async () => result.current.handleQuietEnd());

      expect(mockStartAlarmVibration).toHaveBeenCalledWith(pattern);
    });

    it("restarts the native vibration when the sound fails to return", async () => {
      const { result } = await mount();
      await act(async () => result.current.handleQuietStart());
      mockStartAlarmVibration.mockClear();
      mockStartAlarmSound.mockRejectedValueOnce(new Error("no audio session"));

      await act(async () => result.current.handleQuietEnd());

      expect(mockLogWarn).toHaveBeenCalledWith(
        "Sound",
        expect.stringContaining("no audio session")
      );
      expect(mockStartAlarmVibration).toHaveBeenCalledTimes(1);
    });

    it("leaves no native vibration running once the task is solved", async () => {
      const { result } = await mount();

      await act(async () => result.current.handleQuietStart());
      await act(async () => result.current.handleQuietEnd());
      await act(async () => {
        await result.current.handleChallengeComplete();
      });

      expect(mockNativeVibrating).toBe(false);
    });

    it("does not restart the native vibration after the alarm is solved", async () => {
      const { result } = await mount();

      await act(async () => {
        await result.current.handleChallengeComplete();
      });
      await act(async () => result.current.handleQuietEnd());

      expect(mockStartAlarmVibration).not.toHaveBeenCalled();
    });

    it("restarts the native vibration when the snooze fails in quiet time", async () => {
      mockSnoozeAlarm.mockResolvedValue(null);
      const { result } = await mount();

      await act(async () => result.current.handleQuietStart());
      await act(async () => {
        await result.current.handleSnooze();
      });

      expect(mockStartAlarmVibration).toHaveBeenCalledWith(FAJR_PATTERN);
    });

    it("rings when quiet time ends after a snooze that threw", async () => {
      mockSnoozeAlarm.mockRejectedValue(new Error("cancel failed"));
      const { result } = await mount();

      await act(async () => result.current.handleQuietStart());
      await act(async () => {
        await result.current.handleSnooze();
      });
      mockStartAlarmVibration.mockClear();
      await act(async () => result.current.handleQuietStart());
      await act(async () => {
        await result.current.handleQuietEnd();
      });

      expect(mockStartAlarmVibration).toHaveBeenCalledWith(FAJR_PATTERN);
      expect(mockMarkAlarmHandled).not.toHaveBeenCalled();
    });

    it("does not ring when quiet time ends while a snooze is in flight", async () => {
      let finishSnooze: () => void = () => undefined;
      mockSnoozeAlarm.mockReturnValueOnce(
        new Promise((resolve) => {
          finishSnooze = () =>
            resolve({
              snoozeId: SNOOZE_ID,
              snoozeEndTime: new Date(Date.now() + 5 * 60_000),
              snoozeCount: 1,
            });
        })
      );
      const { result } = await mount();
      await act(async () => result.current.handleQuietStart());
      mockStartAlarmSound.mockClear();

      // Sets only refs before its await, so it needs no act() of its own.
      const snooze = result.current.handleSnooze();
      await act(async () => result.current.handleQuietEnd());
      await act(async () => {
        finishSnooze();
        await snooze;
      });

      expect(mockStartAlarmSound).not.toHaveBeenCalled();
      expect(mockStartAlarmVibration).not.toHaveBeenCalled();
    });
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
