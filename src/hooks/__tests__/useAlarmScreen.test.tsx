import fs from "fs";
import path from "path";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Vibration } from "react-native";
import * as ExpoAlarm from "expo-alarm";
import { router } from "expo-router";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { EMERGENCY_QUIET_MS } from "@/constants/EmergencyQuiet";
import { ScheduledAlarmType } from "@/enums/alarm";
import { setAlarmScreenActive } from "@/hooks/useAlarmDeepLink";
import { useAlarmScreen } from "@/hooks/useAlarmScreen";
import { DEFAULT_VIBRATION_CONFIG, VIBRATION_PATTERNS, VibrationPattern } from "@/types/alarm";
import { DEFAULT_WAKE_TASKS } from "@/constants/WakeTask";
import { generateDeterministicUUID, getQuietKey } from "@/utils/alarmId";

const mockStartAlarmSound = jest.fn((_name: string) => Promise.resolve(true));
const mockCompleteAndReschedule = jest.fn((_id: string, _ending: object) => Promise.resolve());
const mockSnoozeAlarm = jest.fn();
const mockQuietAlarm = jest.fn();
const mockRecordUse = jest.fn();
const mockAlarms: Record<string, object> = {};
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
  tasks: DEFAULT_WAKE_TASKS,
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
  const { ALARM_OUTCOME, CHALLENGE_TYPE, CHALLENGE_DIFFICULTY } = jest.requireActual("expo-alarm");
  return {
    ALARM_OUTCOME,
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
    select({
      snoozeAlarm: mockSnoozeAlarm,
      quietAlarm: mockQuietAlarm,
      scheduledAlarms: mockAlarms,
    }),
}));
jest.mock("@/stores/emergencyQuiet", () => ({
  useEmergencyQuietStore: {
    getState: () => ({ recordUse: (now: number) => mockRecordUse(now) }),
    persist: { hasHydrated: () => true, onFinishHydration: () => () => undefined },
  },
}));
jest.mock("@/stores/alarmSettings", () => ({
  useAlarmSettingsStore: (select: (state: object) => unknown) => select(mockStoreState),
}));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn() } }));
jest.mock("@/utils/alarmScheduler", () => ({
  completeAndRescheduleAlarm: (id: string, ending: object) => mockCompleteAndReschedule(id, ending),
}));
const mockMarkAlarmHandled = jest.fn();
const mockIsAlarmHandled = jest.fn((_id: string) => false);
jest.mock("@/hooks/useAlarmDeepLink", () => ({
  markAlarmHandled: (id: string) => mockMarkAlarmHandled(id),
  isAlarmHandled: (id: string) => mockIsAlarmHandled(id),
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

const mount = (alarmType: string = ScheduledAlarmType.FAJR, alarmId = ALARM_ID) =>
  renderHook(() => useAlarmScreen(alarmId, alarmType));

/** Stores a quiet's re-ring as quietAlarm does, and returns its id. */
const storeReRing = (ringsAt: Date): string => {
  const quietId = generateDeterministicUUID(getQuietKey(ScheduledAlarmType.FAJR, ringsAt));
  mockAlarms[quietId] = {
    alarmId: quietId,
    alarmType: ScheduledAlarmType.FAJR,
    triggerTime: ringsAt.getTime(),
    snoozeCount: 0,
    quietUsed: true,
  };
  return quietId;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState = QUIET_STORE;
  mockNativeVibrating = true;
  mockIsAlarmHandled.mockReturnValue(false);
  for (const id of Object.keys(mockAlarms)) delete mockAlarms[id];
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

    expect(mockCompleteAndReschedule).toHaveBeenCalledWith(SNOOZE_ID, {
      outcome: ExpoAlarm.ALARM_OUTCOME.SOLVED,
    });
  });

  // The solved panel stays until its Close.
  it("completes a solved alarm and stays on the screen", async () => {
    const { result } = await mount();

    await act(async () => {
      await result.current.handleChallengeComplete();
    });

    expect(mockCompleteAndReschedule).toHaveBeenCalledWith(ALARM_ID, {
      outcome: ExpoAlarm.ALARM_OUTCOME.SOLVED,
    });
    expect(result.current.isDismissed).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });

  // The deep link waits for the screen's guard; a solve recorded releases it.
  it("releases the screen's guard once the solve is recorded", async () => {
    const { result } = await mount();
    jest.mocked(setAlarmScreenActive).mockClear();

    await act(async () => {
      await result.current.handleChallengeComplete();
    });

    expect(setAlarmScreenActive).toHaveBeenCalledWith(null);
  });

  describe("solved during a snooze", () => {
    const SNOOZE_MS = 5 * 60_000;
    beforeEach(() => jest.useFakeTimers({ now: new Date(2026, 10, 21, 5) }));
    afterEach(() => jest.useRealTimers());

    it("stays snoozed past the snooze's end, and stays on screen", async () => {
      mockSnoozeAlarm.mockResolvedValue({
        snoozeId: SNOOZE_ID,
        snoozeEndTime: new Date(Date.now() + SNOOZE_MS),
        snoozeCount: 1,
      });
      const { result } = await mount();
      await act(async () => {
        await result.current.handleSnooze();
      });
      await act(async () => {
        await result.current.handleChallengeComplete();
      });
      mockIsAlarmHandled.mockReturnValue(true);
      mockStartAlarmSound.mockClear();

      await act(async () => jest.advanceTimersByTime(SNOOZE_MS + 2000));

      expect(result.current.isSnoozed).toBe(true);
      expect(router.replace).not.toHaveBeenCalled();
      expect(mockStartAlarmSound).not.toHaveBeenCalled();
    });
  });

  it("closes a stopped alarm to Today", async () => {
    const { result } = await mount();

    await act(async () => {
      await result.current.handleChallengeComplete();
    });
    await act(async () => result.current.handleClose());

    expect(router.replace).toHaveBeenCalledWith(BACK_DESTINATION.HOME.href);
  });

  it("stops an alarm with no task as solved and goes to Today", async () => {
    const { result } = await mount();

    await act(async () => {
      await result.current.handlePlainStop();
    });

    expect(ExpoAlarm.stopAllAlarmEffects).toHaveBeenCalled();
    expect(mockCompleteAndReschedule).toHaveBeenCalledWith(ALARM_ID, {
      outcome: ExpoAlarm.ALARM_OUTCOME.SOLVED,
    });
    expect(router.replace).toHaveBeenCalledWith(BACK_DESTINATION.HOME.href);
  });

  it("records a stop as stopped and goes home", async () => {
    const { result } = await mount();

    await act(async () => {
      await result.current.handleStop();
    });

    expect(ExpoAlarm.stopAllAlarmEffects).toHaveBeenCalled();
    expect(mockMarkAlarmHandled).toHaveBeenCalledWith(ALARM_ID);
    expect(mockCompleteAndReschedule).toHaveBeenCalledWith(ALARM_ID, {
      outcome: ExpoAlarm.ALARM_OUTCOME.STOPPED,
    });
    expect(router.replace).toHaveBeenCalledWith(BACK_DESTINATION.HOME.href);
    expect(result.current.isDismissed).toBe(true);
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
    const ringAroundSilencing = async (
      during: "handleQuietStart" | "handleChallengeComplete" | "handleStop"
    ) => {
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

    it.each(["handleChallengeComplete", "handleStop"] as const)(
      "stays stopped when %s runs while the sound restarts",
      async (end) => {
        await ringAroundSilencing(end);

        expect(Vibration.vibrate).not.toHaveBeenCalled();

        expect(mockStartAlarmVibration).not.toHaveBeenCalled();
        expect(ExpoAlarm.stopAllAlarmEffects).toHaveBeenCalledTimes(1);
        expect(ExpoAlarm.restoreSystemVolume).toHaveBeenCalledTimes(1);
      }
    );

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

  describe("emergency quiet", () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date(2026, 10, 21, 5) });
      mockStoreState = VIBRATING_STORE;
      mockQuietAlarm.mockImplementation((_id: string, { ringsAt }: { ringsAt: Date }) =>
        Promise.resolve({ quietId: storeReRing(ringsAt), ringsAt })
      );
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    const quietNow = async () => {
      const view = await mount();
      await act(async () => view.result.current.emergency.open());
      await act(async () => {
        await view.result.current.emergency.confirm();
      });
      return view;
    };

    it("quiets for its length, then rings again at full sound", async () => {
      const { result } = await quietNow();
      const [alarmId, steps] = mockQuietAlarm.mock.calls[0];

      expect(alarmId).toBe(ALARM_ID);
      expect(steps.ringsAt.getTime() - Date.now()).toBe(EMERGENCY_QUIET_MS);
      expect(result.current.emergency.quietUntil).toBe(steps.ringsAt.getTime());
      expect(result.current.emergency.confirming).toBe(false);
      expect(mockMarkAlarmHandled).toHaveBeenCalledWith(ALARM_ID);
      mockStartAlarmSound.mockClear();
      jest.mocked(Vibration.vibrate).mockClear();

      await act(async () => jest.advanceTimersByTime(EMERGENCY_QUIET_MS - 1));
      expect(mockStartAlarmSound).not.toHaveBeenCalled();
      expect(Vibration.vibrate).not.toHaveBeenCalled();

      await act(async () => jest.advanceTimersByTime(1));
      expect(result.current.emergency.quietUntil).toBeNull();
      expect(mockStartAlarmSound).toHaveBeenCalledTimes(1);
      expect(Vibration.vibrate).toHaveBeenCalled();
    });

    it("counts the use and silences the vibration through the store's steps", async () => {
      await quietNow();
      const [, steps] = mockQuietAlarm.mock.calls[0];
      jest.mocked(Vibration.cancel).mockClear();

      steps.recordUse();
      steps.silence();

      expect(mockRecordUse).toHaveBeenCalledWith(Date.now());
      expect(Vibration.cancel).toHaveBeenCalled();
    });

    it("ends the re-ring, not the replaced alarm, when Stop lands while the quiet commits", async () => {
      let commit: (ringsAt: Date) => void = () => undefined;
      mockQuietAlarm.mockImplementationOnce(
        (_id: string, { ringsAt }: { ringsAt: Date }) =>
          new Promise((resolve) => {
            commit = () => resolve({ quietId: storeReRing(ringsAt), ringsAt });
          })
      );
      const { result } = await mount();
      await act(async () => result.current.emergency.open());

      await act(async () => {
        const confirming = result.current.emergency.confirm();
        await Promise.resolve();
        const stopping = result.current.handleStop();
        commit(new Date());
        await Promise.all([confirming, stopping]);
      });

      const [, { ringsAt }] = mockQuietAlarm.mock.calls[0];
      expect(mockCompleteAndReschedule).toHaveBeenCalledTimes(1);
      expect(mockCompleteAndReschedule).toHaveBeenCalledWith(storeReRing(ringsAt), {
        outcome: ExpoAlarm.ALARM_OUTCOME.STOPPED,
      });
    });

    it("counts nothing once the alarm has ended", async () => {
      const { result } = await quietNow();
      const [, steps] = mockQuietAlarm.mock.calls[0];

      await act(async () => {
        await result.current.handleStop();
      });

      expect(() => steps.recordUse()).toThrow();
      expect(mockRecordUse).not.toHaveBeenCalled();
    });

    it("stays silent when a task's quiet time ends during the quiet", async () => {
      const { result } = await quietNow();
      mockStartAlarmSound.mockClear();

      await act(async () => result.current.handleQuietEnd());

      expect(mockStartAlarmSound).not.toHaveBeenCalled();
    });

    it("offers no snooze during the quiet, and again after it", async () => {
      const { result } = await quietNow();
      expect(result.current.canSnooze).toBe(false);
      expect(result.current.snoozeIsOpen).toBe(true);

      await act(async () => jest.advanceTimersByTime(EMERGENCY_QUIET_MS));
      expect(result.current.canSnooze).toBe(true);
    });

    it("ends the alarm for good when the task is solved during the quiet", async () => {
      const { result } = await quietNow();
      const [, { ringsAt }] = mockQuietAlarm.mock.calls[0];

      await act(async () => {
        await result.current.handleChallengeComplete();
      });

      expect(mockCompleteAndReschedule).toHaveBeenCalledWith(storeReRing(ringsAt), {
        outcome: ExpoAlarm.ALARM_OUTCOME.SOLVED,
      });
    });

    it("keeps ringing and keeps the confirm open when the quiet fails", async () => {
      mockQuietAlarm.mockResolvedValueOnce(null);

      const { result } = await quietNow();

      expect(result.current.emergency.failed).toBe(true);
      expect(result.current.emergency.confirming).toBe(true);
      expect(result.current.emergency.quietUntil).toBeNull();
      expect(mockMarkAlarmHandled).not.toHaveBeenCalled();
    });

    it("clears a failure when the confirm opens again", async () => {
      mockQuietAlarm.mockResolvedValueOnce(null);
      const { result } = await quietNow();

      await act(async () => result.current.emergency.back());
      await act(async () => result.current.emergency.open());

      expect(result.current.emergency.failed).toBe(false);
    });

    it("counts nothing on Back", async () => {
      const { result } = await mount();

      await act(async () => result.current.emergency.open());
      await act(async () => result.current.emergency.back());

      expect(result.current.emergency.confirming).toBe(false);
      expect(mockQuietAlarm).not.toHaveBeenCalled();
    });

    it("restores a running quiet from its record after a relaunch", async () => {
      const ringsAt = new Date(Date.now() + EMERGENCY_QUIET_MS / 2);
      const quietId = storeReRing(ringsAt);

      const { result } = await mount(ScheduledAlarmType.FAJR, quietId);

      expect(result.current.emergency.quietUntil).toBe(ringsAt.getTime());
      expect(result.current.emergency.used).toBe(true);
      expect(mockStartAlarmSound).not.toHaveBeenCalled();

      await act(async () => jest.advanceTimersByTime(EMERGENCY_QUIET_MS / 2));
      expect(result.current.emergency.quietUntil).toBeNull();
      expect(mockStartAlarmSound).toHaveBeenCalledTimes(1);
    });

    it("rings at once for a re-ring whose quiet is over", async () => {
      const quietId = storeReRing(new Date(Date.now() - 1));

      const { result } = await mount(ScheduledAlarmType.FAJR, quietId);

      expect(result.current.emergency.quietUntil).toBeNull();
      expect(mockStartAlarmSound).toHaveBeenCalledTimes(1);
    });

    // The task clock can end its quiet time while the store silences.
    it("stays silent when a task's quiet time ends between the silence and the quiet", async () => {
      let finish: (quieted: boolean) => void = () => undefined;
      mockQuietAlarm.mockImplementationOnce(
        (_id: string, { ringsAt, silence }: { ringsAt: Date; silence: () => void }) => {
          silence();
          return new Promise((resolve) => {
            finish = (quieted) =>
              resolve(quieted ? { quietId: storeReRing(ringsAt), ringsAt } : null);
          });
        }
      );
      const { result } = await mount();
      await act(async () => result.current.emergency.open());
      let confirmed: Promise<void> = Promise.resolve();
      await act(async () => {
        confirmed = result.current.emergency.confirm();
      });
      mockStartAlarmSound.mockClear();

      await act(async () => result.current.handleQuietEnd());
      expect(mockStartAlarmSound).not.toHaveBeenCalled();

      await act(async () => {
        finish(false);
        await confirmed;
      });
      await act(async () => result.current.handleQuietEnd());
      expect(mockStartAlarmSound).toHaveBeenCalledTimes(1);
    });

    it("closes a confirm left open when the alarm snoozes", async () => {
      mockSnoozeAlarm.mockResolvedValue({
        snoozeId: SNOOZE_ID,
        snoozeEndTime: new Date(Date.now() + 5 * 60_000),
        snoozeCount: 1,
      });
      const { result } = await mount();
      await act(async () => result.current.emergency.open());

      await act(async () => {
        await result.current.handleSnooze();
      });

      expect(result.current.emergency.confirming).toBe(false);
    });

    it("reads this alarm's quiet from its record", async () => {
      mockAlarms[ALARM_ID] = { alarmId: ALARM_ID, snoozeCount: 0, quietUsed: true };

      const { result } = await mount();

      expect(result.current.emergency.used).toBe(true);
    });

    it("knows a settings preview", async () => {
      mockAlarms[ALARM_ID] = { alarmId: ALARM_ID, snoozeCount: 0, isPreview: true };

      const { result } = await mount();

      expect(result.current.emergency.preview).toBe(true);
    });
  });
});
