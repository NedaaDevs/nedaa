import type { PrayerId } from "@/constants/Prayer";
import { useAlarmSupported } from "@/hooks/useAlarmSupported";
import { useShownDay } from "@/hooks/useShownDay";
import type { AlarmType } from "@/types/alarm";
import { alarmTypeForPrayer } from "@/utils/alarmTypes";

/** The prayer's alarm on the shown day; null for none or no support. */
export const useAlarmTypeFor = (prayerId: PrayerId): AlarmType | null => {
  const { day } = useShownDay();
  const supported = useAlarmSupported();
  return supported && day ? alarmTypeForPrayer(prayerId, day) : null;
};
