import { AppState, AppStateStatus } from "react-native";

import { LocationMode } from "@/enums/location";
import { useLocationStore } from "@/stores/location";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { syncWidgetSnapshot } from "@/services/widgetSnapshot";
import { ensureAlarmsScheduled, waitForAlarmStores } from "@/utils/alarmScheduler";
import { AppLogger } from "@/utils/appLogger";
import { checkLocationPermission } from "@/utils/location";

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
  await step("timings", refreshWindow);
  await step("ensureAlarms", async () => {
    // Unhydrated stores read as disabled, so the top-up would arm nothing.
    await waitForAlarmStores();
    await ensureAlarmsScheduled();
  });
  // Widgets draw from the refreshed window too.
  await step("widgets", syncWidgetSnapshot);
  await step("reschedule", () => useNotificationStore.getState().rescheduleIfNeeded(false));
};

// One attempt per process: a granted permission with no usable fix would
// otherwise refetch the year on every foreground.
let locationRepairAttempted = false;

/** Showing default-location times that a device fix could now replace. */
const canRepairLocation = async (): Promise<boolean> => {
  if (locationRepairAttempted) return false;
  if (usePrayerTimesStore.getState().didGetCurrentLocation) return false;
  if (useLocationStore.getState().locationMode !== LocationMode.DEVICE) return false;
  return (await checkLocationPermission()).granted;
};

/**
 * Stored rows carry no location, so a fix alone leaves the old city's times in
 * place. Only a forced refetch overwrites them.
 */
const refreshWindow = async (): Promise<void> => {
  const prayerTimes = usePrayerTimesStore.getState();

  if (await canRepairLocation()) {
    locationRepairAttempted = true;
    await prayerTimes.loadPrayerTimes(true);
    return;
  }

  // The reschedule reads the store's two-week projection, so re-derive it first.
  await prayerTimes.refreshTimingsFromDb();
};

// Independent steps: one rejection must not cancel the rest, or escape unhandled.
const step = async (name: string, run: () => Promise<unknown>): Promise<void> => {
  try {
    await run();
  } catch (error) {
    log.e("ForegroundReschedule", `${name} failed`, error instanceof Error ? error : undefined);
  }
};
