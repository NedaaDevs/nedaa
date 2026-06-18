import { QuranContentDB } from "@/services/quran-content-db";
import { useQuranStore } from "@/stores/quran";

// Resolves a Quran reminder tap to the surah's first page and drives the reader.
// The page is resolved from the content DB at runtime (edition-safe); a missing
// surah or undownloaded content is a graceful no-op (the reader stays put).
export const openQuranReminderTarget = async (data: { surah?: number }): Promise<void> => {
  if (!data.surah) return;
  try {
    const surah = await QuranContentDB.getSurah(data.surah);
    if (!surah) return;
    useQuranStore.getState().setCurrentPage(surah.pageStart);
  } catch (error) {
    console.error("[QuranReminder] deep-link failed:", error);
  }
};
