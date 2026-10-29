import { act, renderHook } from "@testing-library/react-native";
import { PermissionStatus } from "expo-notifications";

import { type ColumnInput } from "@/components/onboarding/column";
import { NEW_SESSION } from "@/components/onboarding/flow/types";
import {
  toColumnInput,
  useOnboardingColumn,
  type AtStart,
  type DeviceRead,
} from "@/components/onboarding/flow/useOnboardingColumn";
import { ALARM_TYPE } from "@/constants/Alarm";
import { APP_STATE } from "@/constants/AppState";
import {
  LOCATION_CHOICE,
  NATIVE_READ_TIMEOUT_MS,
  ONBOARDING_PATH,
  ONBOARDING_STEP as S,
  type OnboardingPath,
} from "@/constants/Onboarding";
import { LocationMode } from "@/enums/location";
import { initDatabases } from "@/services/databases";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { captureAppState, emitAppState } from "@/test-helpers/appStateMock";
import { columnFor, upgradeColumnFor } from "@/test-helpers/onboardingColumn";
import { RIYADH_DAY } from "@/test-helpers/prayerDay";
import { later, never } from "@/test-helpers/promises";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { alarmSupport } from "@/utils/alarmSupport";
import { AppLogger } from "@/utils/appLogger";
import { checkLocationPermission } from "@/utils/location";
import { checkPermissions } from "@/utils/notifications";

jest.mock("@/utils/location", () => ({
  ...jest.requireActual("@/utils/location"),
  checkLocationPermission: jest.fn(),
}));
// The real module warns about Expo Go on import; the hook reads only these.
jest.mock("expo-notifications", () => ({
  PermissionStatus: { GRANTED: "granted", UNDETERMINED: "undetermined", DENIED: "denied" },
}));
jest.mock("@/utils/notifications", () => ({ checkPermissions: jest.fn() }));
jest.mock("@/utils/alarmSupport", () => ({ alarmSupport: jest.fn() }));
jest.mock("@/services/databases", () => ({ initDatabases: jest.fn() }));

/** Today stored for a verified place, where alarms can ring. */
const STORED: Partial<ColumnInput> = { todayStored: true, alarmsOffered: true };
/** Every permission granted on the automatic path. */
const GRANTED: Partial<ColumnInput> = {
  choseAutomaticLocation: true,
  locationPermissionGranted: true,
  notificationsGranted: true,
};
/** The column with today stored; only the alarm steps depend on AlarmKit. */
const storedColumn = (patch: Partial<ColumnInput>) => columnFor({ ...STORED, ...patch });
const WITH_ALARMS = storedColumn(GRANTED);
const WITHOUT_ALARMS = storedColumn({ ...GRANTED, alarmsOffered: false });
/** Rolls the stored days; the default keeps them as they are. */
const mockRefresh = jest.fn(async (): Promise<DayPrayerTimes[]> => []);

/** A native read that answers `value` after `ms`. */
const after = <T,>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

const LOCATION_GRANTED = { granted: true, canAskAgain: true };
const NOTIFICATIONS_GRANTED = { status: PermissionStatus.GRANTED };
const NOTIFICATIONS_UNDETERMINED = { status: PermissionStatus.UNDETERMINED };

const silencedWarn = () => jest.spyOn(AppLogger.create("app"), "w").mockImplementation(() => {});
const advance = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const renderColumn = async (path: OnboardingPath = ONBOARDING_PATH.FIRST_RUN) => {
  const view = await renderHook(() => useOnboardingColumn(NEW_SESSION, path));
  await advance(0);
  return view;
};

/** The app goes away and comes back, as after a trip to Settings. */
const returnToApp = async () => {
  await advance(1);
  await act(async () => emitAppState(APP_STATE.BACKGROUND, APP_STATE.ACTIVE));
};

beforeEach(() => {
  jest.useFakeTimers();
  captureAppState();
  jest.mocked(checkLocationPermission).mockReset().mockResolvedValue(LOCATION_GRANTED);
  jest.mocked(checkPermissions).mockReset().mockResolvedValue(NOTIFICATIONS_GRANTED);
  jest.mocked(alarmSupport).mockReset().mockResolvedValue(true);
  useLocationStore.setState({
    locationMode: LocationMode.DEVICE,
    manualLocation: null,
    lastKnownCoords: null,
  });
  jest.mocked(initDatabases).mockReset().mockResolvedValue(undefined);
  mockRefresh.mockReset().mockResolvedValue([]);
  usePrayerTimesStore.setState({
    todayTimings: RIYADH_DAY,
    usingDefaultLocation: false,
    refreshTimingsFromDb: mockRefresh,
  });
  useAlarmSettingsStore.setState(useAlarmSettingsStore.getInitialState());
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("useOnboardingColumn's native reads", () => {
  it("uses fast reads as they answer", async () => {
    const warn = silencedWarn();
    const { result } = await renderColumn();

    expect(result.current).toEqual(WITH_ALARMS);
    expect(warn).not.toHaveBeenCalled();
  });

  it("uses reads that answer just inside the time, and logs nothing", async () => {
    const warn = silencedWarn();
    const inTime = NATIVE_READ_TIMEOUT_MS - 1;
    jest.mocked(checkLocationPermission).mockReturnValue(after(inTime, LOCATION_GRANTED));
    jest.mocked(checkPermissions).mockReturnValue(after(inTime, NOTIFICATIONS_GRANTED));
    jest.mocked(alarmSupport).mockReturnValue(after(inTime, true));
    const { result } = await renderColumn();

    await advance(inTime);
    await advance(NATIVE_READ_TIMEOUT_MS);

    expect(result.current).toEqual(WITH_ALARMS);
    expect(warn).not.toHaveBeenCalled();
  });

  // Fail closed: an alarm that cannot be confirmed is never offered.
  it("offers no alarm step when AlarmKit never answers, once the time passes", async () => {
    const warn = silencedWarn();
    jest.mocked(alarmSupport).mockReturnValue(never());
    const { result } = await renderColumn();

    await advance(NATIVE_READ_TIMEOUT_MS - 1);
    expect(result.current).toBeNull();

    await advance(1);
    expect(result.current).toEqual(WITHOUT_ALARMS);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("counts a location read that never answers as not granted, once the time passes", async () => {
    const warn = silencedWarn();
    jest.mocked(checkLocationPermission).mockReturnValue(never());
    const { result } = await renderColumn();

    await advance(NATIVE_READ_TIMEOUT_MS - 1);
    expect(result.current).toBeNull();

    await advance(1);
    expect(result.current).toEqual(storedColumn({ notificationsGranted: true }));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("counts a notification read that never answers as not granted, once the time passes", async () => {
    const warn = silencedWarn();
    jest.mocked(checkPermissions).mockReturnValue(never());
    const { result } = await renderColumn();

    await advance(NATIVE_READ_TIMEOUT_MS - 1);
    expect(result.current).toBeNull();

    await advance(1);
    expect(result.current).toEqual(
      storedColumn({ choseAutomaticLocation: true, locationPermissionGranted: true })
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("logs one warning per read with no answer", async () => {
    const warn = silencedWarn();
    jest.mocked(checkLocationPermission).mockReturnValue(never());
    jest.mocked(checkPermissions).mockReturnValue(never());
    jest.mocked(alarmSupport).mockReturnValue(never());
    const { result } = await renderColumn();

    await advance(NATIVE_READ_TIMEOUT_MS);
    await advance(NATIVE_READ_TIMEOUT_MS * 5);

    expect(result.current).toEqual(storedColumn({ alarmsOffered: false }));
    expect(warn).toHaveBeenCalledTimes(3);
  });
});

describe("permission re-reads on a return to the app", () => {
  it("keeps a known location answer when the re-read stalls", async () => {
    silencedWarn();
    jest
      .mocked(checkLocationPermission)
      .mockResolvedValueOnce(LOCATION_GRANTED)
      .mockReturnValue(never());
    const { result } = await renderColumn();
    expect(result.current).toEqual(WITH_ALARMS);

    await returnToApp();
    await advance(NATIVE_READ_TIMEOUT_MS);

    expect(checkLocationPermission).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(WITH_ALARMS);
  });

  it("keeps a known notification answer when the re-read stalls", async () => {
    silencedWarn();
    jest
      .mocked(checkPermissions)
      .mockResolvedValueOnce(NOTIFICATIONS_GRANTED)
      .mockReturnValue(never());
    const { result } = await renderColumn();
    expect(result.current).toEqual(WITH_ALARMS);

    await returnToApp();
    await advance(NATIVE_READ_TIMEOUT_MS);

    expect(checkPermissions).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(WITH_ALARMS);
  });

  // A change made in Settings still lands.
  it("takes a re-read that answers", async () => {
    jest
      .mocked(checkPermissions)
      .mockResolvedValueOnce(NOTIFICATIONS_GRANTED)
      .mockResolvedValue(NOTIFICATIONS_UNDETERMINED);
    const { result } = await renderColumn();
    expect(result.current).toEqual(WITH_ALARMS);

    await returnToApp();
    await advance(0);

    expect(result.current).toEqual(
      storedColumn({ choseAutomaticLocation: true, locationPermissionGranted: true })
    );
  });
});

describe("AlarmKit on a return to the app", () => {
  // The shared source hands every reader the one native answer, however late.
  it("adds the alarm steps on a return once AlarmKit answers after the first read timed out", async () => {
    silencedWarn();
    const late = later<boolean>();
    jest.mocked(alarmSupport).mockReturnValue(late.promise);
    const { result } = await renderColumn();
    await advance(NATIVE_READ_TIMEOUT_MS);
    expect(result.current).toEqual(WITHOUT_ALARMS);

    late.release(true);
    await advance(0);
    expect(result.current).toEqual(WITHOUT_ALARMS);

    await returnToApp();
    await advance(0);

    expect(alarmSupport).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(WITH_ALARMS);
  });

  it("bounds the read on a return with the same timeout", async () => {
    const warn = silencedWarn();
    jest.mocked(alarmSupport).mockReturnValueOnce(never()).mockReturnValue(never());
    const { result } = await renderColumn();
    await advance(NATIVE_READ_TIMEOUT_MS);

    await returnToApp();
    await advance(NATIVE_READ_TIMEOUT_MS);

    expect(alarmSupport).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(WITHOUT_ALARMS);
  });

  // An alarm step once offered stays: the user may be on it.
  it("keeps the alarm steps when a later read stalls, fails or says no", async () => {
    silencedWarn();
    jest
      .mocked(alarmSupport)
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(never())
      .mockRejectedValueOnce(new Error("read failed"))
      .mockResolvedValueOnce(false);
    const { result } = await renderColumn();
    expect(result.current).toEqual(WITH_ALARMS);

    await returnToApp();
    await advance(NATIVE_READ_TIMEOUT_MS);
    expect(result.current).toEqual(WITH_ALARMS);

    await returnToApp();
    await advance(0);
    expect(result.current).toEqual(WITH_ALARMS);

    await returnToApp();
    await advance(0);
    expect(result.current).toEqual(WITH_ALARMS);
    expect(alarmSupport).toHaveBeenCalledTimes(4);
  });
});

describe("the alarm steps", () => {
  it("offers both where alarms can ring at a verified place's times", async () => {
    const { result } = await renderColumn();

    expect(result.current).toEqual(WITH_ALARMS);
  });

  it("offers none at the default location's times", async () => {
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY, usingDefaultLocation: true });
    const { result } = await renderColumn();

    expect(result.current).toEqual(columnFor(GRANTED));
  });

  it("offers none where alarms cannot ring", async () => {
    jest.mocked(alarmSupport).mockResolvedValue(false);
    const { result } = await renderColumn();

    expect(result.current).toEqual(WITHOUT_ALARMS);
  });
});

describe("the snapshot at the start", () => {
  // Each alarm's own switch decides its own step.
  it.each([
    [ALARM_TYPE.FAJR, S.FRIDAY_ALARM],
    [ALARM_TYPE.FRIDAY, S.FAJR_ALARM],
  ])("offers only the other alarm step when %s is already on", async (type, other) => {
    useAlarmSettingsStore.getState().setEnabled(type, true);
    const { result } = await renderColumn();

    expect(result.current?.filter((id) => id === S.FAJR_ALARM || id === S.FRIDAY_ALARM)).toEqual([
      other,
    ]);
  });

  it("waits for the stored location before it reads the column", async () => {
    let finish = () => {};
    jest.spyOn(useLocationStore.persist, "hasHydrated").mockReturnValue(false);
    jest.spyOn(useLocationStore.persist, "onFinishHydration").mockImplementation((listener) => {
      finish = () => listener(useLocationStore.getState());
      return () => {};
    });
    useLocationStore.setState({ locationMode: LocationMode.MANUAL, lastKnownCoords: null });
    const { result } = await renderColumn();
    expect(result.current).toBeNull();

    // The stored city lands with the location store.
    useLocationStore.setState({ lastKnownCoords: { latitude: 21.4, longitude: 39.8 } });
    await act(async () => finish());
    await advance(0);

    expect(result.current).not.toContain(S.LOCATION);
  });
});

describe("the stored days", () => {
  it("rolls them to the clock before the column is read", async () => {
    const roll = later<DayPrayerTimes[]>();
    mockRefresh.mockReturnValue(roll.promise);
    const { result } = await renderColumn();
    expect(initDatabases).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();

    await act(async () => {
      // The stored day was an earlier one: nothing matches today.
      usePrayerTimesStore.setState({ todayTimings: null });
      roll.release([]);
    });
    await advance(0);

    expect(result.current).toEqual(columnFor(GRANTED));
  });

  it("keeps them as stored when the databases fail to open, and logs it", async () => {
    const warn = silencedWarn();
    jest.mocked(initDatabases).mockRejectedValue(new Error("open failed"));
    const { result } = await renderColumn();

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(result.current).toEqual(WITH_ALARMS);
    expect(warn).toHaveBeenCalledWith("Onboarding", expect.stringContaining("open failed"));
  });
});

describe("toColumnInput", () => {
  const AT_START: AtStart = {
    hasCity: true,
    deviceMode: false,
    fajrAlarmOn: false,
    fridayAlarmOn: true,
  };
  const SUPPORTED: DeviceRead = {
    location: false,
    notifications: false,
    notificationsUndetermined: false,
    alarmsSupported: true,
  };
  const input = (device: DeviceRead, todayStored: boolean) =>
    toColumnInput({ session: NEW_SESSION, atStart: AT_START, device, todayStored });

  it.each<[string, DeviceRead, boolean, boolean]>([
    ["supported, today stored", SUPPORTED, true, true],
    ["supported, no verified day", SUPPORTED, false, false],
    ["unsupported, today stored", { ...SUPPORTED, alarmsSupported: false }, true, false],
  ])("offers alarms when %s", (_, device, todayStored, offered) => {
    expect(input(device, todayStored).alarmsOffered).toBe(offered);
  });

  it("passes the city stored at the start apart from one picked on the path", () => {
    const picked = toColumnInput({
      session: { ...NEW_SESSION, locationChoice: LOCATION_CHOICE.CITY },
      atStart: { ...AT_START, hasCity: false },
      device: SUPPORTED,
      todayStored: true,
    });

    expect(input(SUPPORTED, true)).toMatchObject({ hasCity: true, hadCity: true });
    expect(picked).toMatchObject({ hasCity: true, hadCity: false });
  });

  it("passes the device's never-asked notifications", () => {
    const undetermined = input({ ...SUPPORTED, notificationsUndetermined: true }, true);

    expect(undetermined.notificationsUndetermined).toBe(true);
  });

  it("passes the alarms' own state at the start, whatever the device", () => {
    const unsupported = input({ ...SUPPORTED, alarmsSupported: false }, true);

    expect(unsupported).toMatchObject({ fajrAlarmOn: false, fridayAlarmOn: true });
  });
});

describe("useOnboardingColumn on the upgrade path", () => {
  const NOTIFICATIONS_DENIED = { status: PermissionStatus.DENIED };
  const withCity = () =>
    useLocationStore.setState({ lastKnownCoords: { latitude: 21.4, longitude: 39.8 } });

  it("draws the upgrade column", async () => {
    withCity();
    const { result } = await renderColumn(ONBOARDING_PATH.UPGRADE);

    expect(result.current).toEqual(
      upgradeColumnFor({ notificationsGranted: true, notificationsUndetermined: false })
    );
  });

  it("asks about notifications only when the OS never asked", async () => {
    withCity();
    jest.mocked(checkPermissions).mockResolvedValue(NOTIFICATIONS_UNDETERMINED);
    const asked = await renderColumn(ONBOARDING_PATH.UPGRADE);
    expect(asked.result.current).toContain(S.NOTIFICATIONS);
    await asked.unmount();

    jest.mocked(checkPermissions).mockResolvedValue(NOTIFICATIONS_DENIED);
    const denied = await renderColumn(ONBOARDING_PATH.UPGRADE);
    expect(denied.result.current).not.toContain(S.NOTIFICATIONS);
  });

  // The step that asks stays while its answer shows.
  it("keeps the never-asked answer of the first read through a later no", async () => {
    withCity();
    jest.mocked(checkPermissions).mockResolvedValue(NOTIFICATIONS_UNDETERMINED);
    const { result } = await renderColumn(ONBOARDING_PATH.UPGRADE);

    jest.mocked(checkPermissions).mockResolvedValue(NOTIFICATIONS_DENIED);
    await returnToApp();
    await advance(0);

    expect(checkPermissions).toHaveBeenCalledTimes(2);
    expect(result.current).toContain(S.NOTIFICATIONS);
  });
});
