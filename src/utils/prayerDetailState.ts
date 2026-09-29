import { PRAYER_DETAIL_STATE, type PrayerDetailState } from "@/constants/PrayerDetail";
import type { PrayerId } from "@/constants/Prayer";
import type { DayPrayerTimes } from "@/types/prayerTimes";

type Inputs = {
  prayerId: PrayerId;
  /** The prayer day the sheet shows; null until times load. */
  day: DayPrayerTimes | null;
  /** The prayer-times store is fetching. */
  isLoading: boolean;
  /** The prayer-times store's last load failed. */
  hasError: boolean;
  /** The notification store has read its persisted settings. */
  settingsHydrated: boolean;
};

/** Which view the prayer-detail sheet shows for one prayer. */
export const prayerDetailState = ({
  prayerId,
  day,
  isLoading,
  hasError,
  settingsHydrated,
}: Inputs): PrayerDetailState => {
  // A known time outranks a reload or a failed refresh: the settings still apply.
  if (day?.timings[prayerId]) {
    return settingsHydrated ? PRAYER_DETAIL_STATE.READY : PRAYER_DETAIL_STATE.LOADING;
  }
  if (hasError) return PRAYER_DETAIL_STATE.ERROR;
  if (isLoading || !settingsHydrated) return PRAYER_DETAIL_STATE.LOADING;
  return PRAYER_DETAIL_STATE.UNAVAILABLE;
};
