import { AppState, AppStateStatus } from "react-native";

import { TIMES_PLACE } from "@/constants/Location";
import { LocationMode } from "@/enums/location";
import { useLocationStore } from "@/stores/location";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { syncWidgetSnapshot } from "@/services/widgetSnapshot";
import {
  ensureAlarmsScheduled,
  rescheduleAllAlarms,
  waitForAlarmStores,
} from "@/utils/alarmScheduler";
import { AppLogger } from "@/utils/appLogger";
import { checkLocationPermission } from "@/utils/location";
import { timesMoved } from "@/utils/placeFromFacts";
import { readTimesPlace } from "@/utils/timesPlace";

const log = AppLogger.create("alarm");

let registered = false;

// Warm foregrounds never pass through appSetup, so a device the user never
// cold-starts would stop getting fresh notifications and alarms. Kept cheap by
// rescheduleIfNeeded's same-day guard, and by ensureAlarmsScheduled skipping any
// type the store already holds a record for — past-due records included.
export const registerForegroundReschedule = (): void => {
  if (registered) return;
  registered = true;

  AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state !== "active") return;
    void runForegroundWork();
  });
};

// Alarms first: they need only the refreshed window, while the reschedule
// rewrites every pending notification and can outlive a short foreground.
const runForegroundWork = async (): Promise<void> => {
  let repaired = false;
  await step("timings", async () => {
    repaired = await refreshWindow();
  });
  await step("ensureAlarms", async () => {
    // Unhydrated stores read as disabled, so the top-up would arm nothing.
    await waitForAlarmStores();
    // The top-up keeps an armed alarm, so a repaired place's alarms move.
    if (repaired) await rescheduleAllAlarms();
    else await ensureAlarmsScheduled();
  });
  // Widgets draw from the refreshed window too.
  await step("widgets", syncWidgetSnapshot);
  await step("reschedule", () => useNotificationStore.getState().rescheduleIfNeeded(false));
};

// One attempt per process: a fix or a fetch that keeps failing would
// otherwise refetch the year on every foreground.
let locationRepairAttempted = false;

/** Times that are not the saved place's, which a refetch can replace. */
const canRepairLocation = async (): Promise<boolean> => {
  if (locationRepairAttempted) return false;
  const place = await readTimesPlace();
  // Unloaded stores hold defaults, not the place; the retry stays for later.
  if (place === TIMES_PLACE.UNKNOWN) return false;
  const { didGetCurrentLocation, loadingTimes, timesCoords } = usePrayerTimesStore.getState();
  // The running load owns the outcome; the retry stays for a later foreground.
  if (loadingTimes) return false;
  // A verified place whose own rows a failed fetch never stored.
  if (place === TIMES_PLACE.AWAITING_TIMES) return true;
  const location = useLocationStore.getState();
  // A verified place whose days were fetched for another place.
  if (place === TIMES_PLACE.VERIFIED && timesMoved(timesCoords, location.locationDetails.coords)) {
    return true;
  }
  if (didGetCurrentLocation) return false;
  if (location.locationMode !== LocationMode.DEVICE) return false;
  return (await checkLocationPermission()).granted;
};

/** The stored times are the saved place's, verified and fetched there. */
const timesAtSavedPlace = async (): Promise<boolean> =>
  (await readTimesPlace()) === TIMES_PLACE.VERIFIED &&
  !timesMoved(
    usePrayerTimesStore.getState().timesCoords,
    useLocationStore.getState().locationDetails.coords
  );

/**
 * Stored rows carry no location, so a fix alone leaves the old city's times in
 * place. Only a forced refetch overwrites them. Resolves whether one landed.
 */
const refreshWindow = async (): Promise<boolean> => {
  const prayerTimes = usePrayerTimesStore.getState();

  if (await canRepairLocation()) {
    locationRepairAttempted = true;
    await prayerTimes.loadPrayerTimes(true);
    return timesAtSavedPlace();
  }

  // The reschedule reads the store's two-week projection, so re-derive it first.
  await prayerTimes.refreshTimingsFromDb();
  return false;
};

// Independent steps: one rejection must not cancel the rest, or escape unhandled.
const step = async (name: string, run: () => Promise<unknown>): Promise<void> => {
  try {
    await run();
  } catch (error) {
    log.e("ForegroundReschedule", `${name} failed`, error instanceof Error ? error : undefined);
  }
};
