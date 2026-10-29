import { useEffect, useState } from "react";
import { PermissionStatus } from "expo-notifications";

import { PATH_COLUMN, type ColumnInput } from "@/components/onboarding/column";
import type { OnboardingSession } from "@/components/onboarding/flow/types";
import { ALARM_TYPE } from "@/constants/Alarm";
import {
  LOCATION_CHOICE,
  NATIVE_READ_TIMEOUT_MS,
  ONBOARDING_HYDRATION_TIMEOUT_MS,
  type OnboardingPath,
  type OnboardingStepId,
} from "@/constants/Onboarding";
import { LocationMode } from "@/enums/location";
import { useAppVisibility } from "@/hooks/useAppVisibility";
import { useTodayStored } from "@/hooks/useTodayStored";
import { initDatabases } from "@/services/databases";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { waitForAlarmStores } from "@/utils/alarmScheduler";
import { alarmSupport } from "@/utils/alarmSupport";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";
import { checkLocationPermission } from "@/utils/location";
import { checkPermissions } from "@/utils/notifications";
import { waitForHydration } from "@/utils/storeHydration";
import { withTimeout } from "@/utils/withTimeout";

const log = AppLogger.create("app");

/** A native read can block while iOS starts; null if it fails or stalls. */
const answerOf = <T>(name: string, read: Promise<T>) =>
  withTimeout<T | null>(read, NATIVE_READ_TIMEOUT_MS, null, () =>
    log.w("Onboarding", `${name} read gave no answer in ${NATIVE_READ_TIMEOUT_MS}ms`)
  );

/** Only the flow's steps change these; read once, so a success keeps a step. */
export type AtStart = {
  hasCity: boolean;
  deviceMode: boolean;
  fajrAlarmOn: boolean;
  fridayAlarmOn: boolean;
};

/** Rolls the stored days to the clock; a failed or stalled roll keeps them. */
const rollStoredDays = () =>
  withTimeout(
    (async () => {
      // The persisted days land first, or they would overwrite the roll.
      await waitForHydration(usePrayerTimesStore.persist);
      await initDatabases();
      await usePrayerTimesStore.getState().refreshTimingsFromDb();
    })().catch((error: unknown) => log.w("Onboarding", `stored days kept: ${errorText(error)}`)),
    ONBOARDING_HYDRATION_TIMEOUT_MS,
    undefined,
    () => log.w("Onboarding", `stored days kept: no roll in ${ONBOARDING_HYDRATION_TIMEOUT_MS}ms`)
  );

const readAtStart = async (): Promise<AtStart> => {
  await Promise.all([
    waitForHydration(useLocationStore.persist, { timeoutMs: ONBOARDING_HYDRATION_TIMEOUT_MS }),
    waitForAlarmStores(),
  ]);
  // After the location loads: the days roll in its timezone.
  await rollStoredDays();
  const location = useLocationStore.getState();
  const alarms = useAlarmSettingsStore.getState();
  return {
    hasCity:
      (location.locationMode === LocationMode.MANUAL && location.manualLocation !== null) ||
      location.lastKnownCoords !== null,
    deviceMode: location.locationMode === LocationMode.DEVICE,
    fajrAlarmOn: alarms[ALARM_TYPE.FAJR].enabled,
    fridayAlarmOn: alarms[ALARM_TYPE.FRIDAY].enabled,
  };
};

/** What the device has answered; read again on every return to the app. */
export type DeviceRead = {
  location: boolean;
  notifications: boolean;
  /** The OS had never asked for notifications when the run started. */
  notificationsUndetermined: boolean;
  alarmsSupported: boolean;
};
type DeviceAnswers = { [K in keyof DeviceRead]: boolean | null };

const readDevice = async (): Promise<DeviceAnswers> => {
  const [location, notificationStatus, alarmsSupported] = await Promise.all([
    answerOf(
      "Location permission",
      checkLocationPermission().then((read) => read.granted)
    ),
    answerOf(
      "Notification permission",
      checkPermissions().then((read) => read.status)
    ),
    answerOf("AlarmKit", alarmSupport()),
  ]);
  const answered = notificationStatus !== null;
  return {
    location,
    notifications: answered ? notificationStatus === PermissionStatus.GRANTED : null,
    notificationsUndetermined: answered
      ? notificationStatus === PermissionStatus.UNDETERMINED
      : null,
    alarmsSupported,
  };
};

/** A read with no answer keeps what is known; on the first read it is a no. */
const merge = (known: DeviceRead | null, answers: DeviceAnswers): DeviceRead => ({
  location: answers.location ?? known?.location ?? false,
  notifications: answers.notifications ?? known?.notifications ?? false,
  // The first read holds, so an answer given in this run keeps its step.
  notificationsUndetermined: known
    ? known.notificationsUndetermined
    : (answers.notificationsUndetermined ?? false),
  // Alarm support only grows, so an alarm step once offered never vanishes.
  alarmsSupported: answers.alarmsSupported === true || known?.alarmsSupported === true,
});

type ColumnReads = {
  session: OnboardingSession;
  atStart: AtStart;
  device: DeviceRead;
  todayStored: boolean;
};

/** The column's input, from what the flow has read. */
export const toColumnInput = ({
  session,
  atStart,
  device,
  todayStored,
}: ColumnReads): ColumnInput => ({
  languageRequested: session.languageRequested,
  hasCity: atStart.hasCity || session.locationChoice === LOCATION_CHOICE.CITY,
  hadCity: atStart.hasCity,
  // A granted device permission is the automatic choice, also after a kill.
  choseAutomaticLocation:
    session.locationChoice === LOCATION_CHOICE.AUTOMATIC || (atStart.deviceMode && device.location),
  locationPermissionGranted: device.location || session.locationGranted,
  todayStored,
  fetchStarted: session.fetchStarted,
  notificationsGranted: device.notifications,
  notificationsUndetermined: device.notificationsUndetermined,
  // An alarm turns on only where it can ring, at a verified place's times.
  alarmsOffered: device.alarmsSupported && todayStored,
  fajrAlarmOn: atStart.fajrAlarmOn,
  fridayAlarmOn: atStart.fridayAlarmOn,
});

/** The walk's column here; null until stores and permissions are read. */
export const useOnboardingColumn = (
  session: OnboardingSession,
  path: OnboardingPath
): OnboardingStepId[] | null => {
  const { becameActiveAt } = useAppVisibility();
  const todayStored = useTodayStored();
  const [atStart, setAtStart] = useState<AtStart | null>(null);
  const [device, setDevice] = useState<DeviceRead | null>(null);

  useEffect(() => {
    let live = true;
    void readAtStart().then((read) => {
      if (live) setAtStart(read);
    });
    return () => {
      live = false;
    };
  }, []);

  // Read again on every return to the app: a grant in Settings lands here.
  useEffect(() => {
    let live = true;
    void readDevice().then((answers) => {
      if (live) setDevice((known) => merge(known, answers));
    });
    return () => {
      live = false;
    };
  }, [becameActiveAt]);

  if (atStart === null || device === null) return null;
  return PATH_COLUMN[path](toColumnInput({ session, atStart, device, todayStored }));
};
