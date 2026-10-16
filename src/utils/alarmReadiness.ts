import { canRing, readAlarmPermissions } from "@/utils/alarmPermissions";
import { isVerifiedPlace } from "@/utils/timesPlace";

/** True when an alarm turned on now would ring, at a verified place's times. */
export const canTurnOnAlarm = async (): Promise<boolean> =>
  (await isVerifiedPlace()) &&
  // A failed read is a no; the gate it leads to reads again.
  (await readAlarmPermissions().then(canRing, () => false));
