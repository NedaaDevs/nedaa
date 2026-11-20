import { useAlarmArmed } from "@/hooks/useAlarmArmed";
import { useVerifiedPlace } from "@/hooks/useVerifiedPlace";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import type { AlarmType } from "@/types/alarm";

/** Whether an alarm reads On: turned on, and armed or at a verified place. */
export const useAlarmOn = (type: AlarmType): boolean => {
  const enabled = useAlarmSettingsStore((state) => state[type].enabled);
  // An armed alarm rings whatever the place reads, so it shows and turns off.
  const armed = useAlarmArmed(type) !== undefined;
  // The stored choice is kept; it reads On again once a city lands.
  const verifiedPlace = useVerifiedPlace();
  return enabled && (verifiedPlace || armed);
};
