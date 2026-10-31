import { PRAYER_ID, type PrayerId } from "@/constants/Prayer";

/** The locale key naming a prayer; Friday's Dhuhr is Jumuah. */
export const prayerNameKey = (id: PrayerId, friday: boolean) =>
  id === PRAYER_ID.DHUHR && friday ? "prayerTimes.jumuah" : `prayerTimes.${id}`;
