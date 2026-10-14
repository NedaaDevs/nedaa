import { useVerifiedPlace } from "@/hooks/useVerifiedPlace";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import type { AlarmType } from "@/types/alarm";

/** Whether an alarm reads On: turned on, and at a verified place's times. */
export const useAlarmOn = (type: AlarmType): boolean => {
  const enabled = useAlarmSettingsStore((state) => state[type].enabled);
  // The stored choice is kept; it reads On again once a city lands.
  const verifiedPlace = useVerifiedPlace();
  return enabled && verifiedPlace;
};
