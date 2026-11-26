import { PrayerTimesDB } from "@/services/db";
import { QadaDB } from "@/services/qada-db";

let opening: Promise<void> | null = null;

/** Opens the app's databases once; a failed open retries on the next call. */
export const initDatabases = (): Promise<void> => {
  opening ??= (async () => {
    await PrayerTimesDB.initialize();
    await QadaDB.initialize();
  })().catch((error) => {
    opening = null;
    throw error;
  });
  return opening;
};
