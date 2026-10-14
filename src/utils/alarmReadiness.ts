import { selectVerifiedPlace, usePrayerTimesStore } from "@/stores/prayerTimes";
import { canRing, readAlarmPermissions } from "@/utils/alarmPermissions";

/** True when an alarm turned on now would ring, at a verified place's times. */
export const canTurnOnAlarm = async (): Promise<boolean> =>
  selectVerifiedPlace(usePrayerTimesStore.getState()) &&
  // A failed read is a no; the gate it leads to reads again.
  (await readAlarmPermissions().then(canRing, () => false));
